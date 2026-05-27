const request = require('supertest');
const app = require('../app');

describe('Express app', () => {
  it('responds with HTML on GET /', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Hello 23520210 - Vo Chi Cuong!');
  });

  it('returns the expected title in the HTML', async () => {
    const response = await request(app).get('/');
    expect(response.text).toContain('<title>Hello 23520210 - Vo Chi Cuong!</title>');
  });
});
