import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    steady: { executor: 'constant-vus', vus: 50, duration: '2m' },
    spike: { executor: 'ramping-vus', startVUs: 0, stages: [
      { duration: '30s', target: 200 }, { duration: '1m', target: 200 }, { duration: '30s', target: 0 },
    ], startTime: '2m30s' },
  },
  thresholds: {
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';
  const r = http.get(`${baseUrl}/api/health`);
  check(r, { 'status 200': (res) => res.status === 200 });
  sleep(1);
}
