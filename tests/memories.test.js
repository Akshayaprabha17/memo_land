const request = require('supertest');
const app = require('../server');

describe('Memories API, DELETE & IDOR Ownership Security', () => {
  let tokenUserA;
  let userA;
  let tokenUserB;
  let userB;
  let memoryUserA;

  beforeAll(async () => {
    const uid = Date.now();
    // Register User A
    const resA = await request(app)
      .post('/api/auth/register')
      .send({
        username: `user_a_${uid}`,
        email: `usera_${uid}@example.com`,
        password: 'password123'
      });
    tokenUserA = resA.body.token;
    userA = resA.body.user;

    // Register User B
    const resB = await request(app)
      .post('/api/auth/register')
      .send({
        username: `user_b_${uid}`,
        email: `userb_${uid}@example.com`,
        password: 'password123'
      });
    tokenUserB = resB.body.token;
    userB = resB.body.user;
  });

  test('POST /api/memories creates a memory for User A', async () => {
    const res = await request(app)
      .post('/api/memories')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        title: "User A's Secret Vault",
        content: "Top secret content for User A only",
        category: "secrets",
        tags: ["secret", "private"]
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.title).toEqual("User A's Secret Vault");
    memoryUserA = res.body;
  });

  test('IDOR check: User B cannot access/modify/lock/unlock/pin/delete User A memory', async () => {
    const memoryId = memoryUserA.id;

    // PUT edit attempt by User B
    const editRes = await request(app)
      .put(`/api/memories/${memoryId}`)
      .set('Authorization', `Bearer ${tokenUserB}`)
      .send({ title: "Hacked Title" });
    expect(editRes.statusCode).toEqual(404);

    // PUT lock attempt by User B
    const lockRes = await request(app)
      .put(`/api/memories/${memoryId}/lock`)
      .set('Authorization', `Bearer ${tokenUserB}`)
      .send({ pin: "1234" });
    expect(lockRes.statusCode).toEqual(404);

    // PATCH pin attempt by User B
    const pinRes = await request(app)
      .patch(`/api/memories/${memoryId}/pin`)
      .set('Authorization', `Bearer ${tokenUserB}`);
    expect(pinRes.statusCode).toEqual(404);

    // POST share attempt by User B
    const shareRes = await request(app)
      .post(`/api/memories/${memoryId}/share`)
      .set('Authorization', `Bearer ${tokenUserB}`)
      .send({ hours: 24 });
    expect(shareRes.statusCode).toEqual(404);

    // DELETE attempt by User B
    const deleteRes = await request(app)
      .delete(`/api/memories/${memoryId}`)
      .set('Authorization', `Bearer ${tokenUserB}`);
    expect(deleteRes.statusCode).toEqual(404);
  });

  test('Unauthenticated user cannot access/modify/delete User A memory', async () => {
    const memoryId = memoryUserA.id;

    const deleteRes = await request(app)
      .delete(`/api/memories/${memoryId}`);
    expect(deleteRes.statusCode).toEqual(401);

    const lockRes = await request(app)
      .put(`/api/memories/${memoryId}/lock`)
      .send({ pin: "1234" });
    expect(lockRes.statusCode).toEqual(401);
  });

  test('Lock, Verify PIN, and Unlock memory flow for owner User A', async () => {
    const memoryId = memoryUserA.id;

    // Lock memory with PIN 5678
    const lockRes = await request(app)
      .put(`/api/memories/${memoryId}/lock`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({ pin: "5678" });
    expect(lockRes.statusCode).toEqual(200);
    expect(lockRes.body.locked).toBe(true);
    expect(lockRes.body.content).toEqual('[LOCKED_CONTENT]');

    // Verify PIN
    const verifyRes = await request(app)
      .post(`/api/memories/${memoryId}/verify`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({ pin: "5678" });
    expect(verifyRes.statusCode).toEqual(200);
    expect(verifyRes.body.content).toEqual("Top secret content for User A only");

    // Unlock memory
    const unlockRes = await request(app)
      .put(`/api/memories/${memoryId}/unlock`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({ pin: "5678" });
    expect(unlockRes.statusCode).toEqual(200);
    expect(unlockRes.body.locked).toBe(false);
  });

  test('DELETE /api/memories/:id successfully deletes memory for owner User A', async () => {
    const memoryId = memoryUserA.id;

    const res = await request(app)
      .delete(`/api/memories/${memoryId}`)
      .set('Authorization', `Bearer ${tokenUserA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);

    // Verify memory is gone
    const listRes = await request(app)
      .get('/api/memories')
      .set('Authorization', `Bearer ${tokenUserA}`);

    const found = listRes.body.data.find(m => m.id === memoryId);
    expect(found).toBeUndefined();
  });
});
