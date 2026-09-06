const request = require('supertest');
const app = require('../server');

describe('Auth Endpoints & Security', () => {
  const uniqueId = Date.now();
  const testUser = {
    username: `testauthuser_${uniqueId}`,
    email: `testauth_${uniqueId}@example.com`,
    password: 'password123',
    avatar: '🔒'
  };

  test('POST /api/auth/register should create a new user and session token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.statusCode).toEqual(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.username).toEqual(testUser.username);
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.salt).toBeUndefined();
    expect(res.body.token).toBeDefined();
  });

  test('POST /api/auth/login should authenticate valid user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        login: testUser.username,
        password: testUser.password
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toEqual(testUser.email);
    expect(res.body.token).toBeDefined();
  });

  test('POST /api/auth/login should reject invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        login: testUser.username,
        password: 'wrongpassword'
      });

    expect(res.statusCode).toEqual(401);
    expect(res.body.error).toBeDefined();
  });

  test('GET /api/auth/me should return logged in user details when session token provided', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        login: testUser.username,
        password: testUser.password
      });

    const token = loginRes.body.token;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.statusCode).toEqual(200);
    expect(meRes.body.user).toBeDefined();
    expect(meRes.body.user.username).toEqual(testUser.username);
  });
});
