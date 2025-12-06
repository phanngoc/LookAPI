## 1. k6 là gì? Tóm tắt nhanh

* Là tool **load testing / performance testing** viết script bằng **JavaScript** (ES6).
* Chạy dạng CLI: `k6 run script.js`.
* Hỗ trợ nhiều kiểu test: load, stress, soak, spike, breakpoint…
* Export kết quả ở JSON, InfluxDB, Prometheus, v.v.

**Cấu trúc cơ bản của một script k6:**

```js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,          // số Virtual Users
  duration: '10s', // thời gian test
};

export default function () {
  const res = http.get('https://test-api.example.com/');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
```

---

## 2. Các phương pháp / kiểu performance test chính

Thông thường khi thiết kế test performance, hay dùng các loại:

1. **Smoke test (Performance sanity)**
2. **Load test (Baseline / normal load)**
3. **Stress test (Quá tải, tìm ngưỡng chịu đựng)**
4. **Spike test (Đột biến tải)**
5. **Soak test / Endurance (Chạy lâu, tìm memory leak)**
6. **Breakpoint / Capacity test (Tìm điểm sập)**

Dưới đây mình liệt kê từng loại + script example tương ứng.

---

## 3. Script ví dụ cho từng phương pháp

### 3.1. Smoke test (Performance sanity)

**Mục tiêu:**

* Kiểm tra nhanh: API/website có chịu nổi một tải nhỏ không.
* Thường chạy trong CI/CD sau mỗi deploy.

**Đặc điểm:**

* VUs ít (1–5)
* Thời gian ngắn (30s – 2 phút)
* Threshold tương đối thoáng

**Script example:**

```js
// smoke-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 2,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.05'], // < 5% request fail
    http_req_duration: ['p(95)<500'], // 95% request < 500ms
  },
};

export default function () {
  const res = http.get('https://api.example.com/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(0.5);
}
```

---

### 3.2. Load test (Baseline load)

**Mục tiêu:**

* Mô phỏng traffic **bình thường / kỳ vọng** (ví dụ: 100 concurrent users).
* Đo response time, error rate ở mức load này.

**Đặc điểm:**

* Thường có **ramping** (tăng dần VUs lên rồi giữ).
* Thời gian vừa phải (10–30 phút).

**Script example (ramping VUs):**

```js
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 },  // ramp up từ 0 lên 50 VUs trong 2 phút
    { duration: '10m', target: 50 }, // giữ 50 VUs trong 10 phút
    { duration: '2m', target: 0 },   // ramp down về 0
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],      // <1% lỗi
    http_req_duration: ['p(95)<800'],    // 95% < 800ms
  },
};

export default function () {
  const res = http.get('https://api.example.com/products');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
```

---

### 3.3. Stress test

**Mục tiêu:**

* Tăng tải **vượt** mức bình thường để:

  * Tìm điểm bắt đầu degrade (chậm tăng mạnh).
  * Xem hệ thống recover thế nào khi giảm tải.

**Đặc điểm:**

* Stages tăng dần tới mức rất cao.
* Có thể quan sát CPU, memory, DB connection, queue, v.v.

**Script example:**

```js
// stress-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // load bình thường
    { duration: '2m', target: 100 },  // tăng
    { duration: '2m', target: 200 },  // tăng nữa
    { duration: '2m', target: 300 },  // vượt mức dự kiến
    { duration: '2m', target: 0 },    // giảm tải
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],          // cho phép lỗi cao hơn
    http_req_duration: ['p(95)<1500'],       // response có thể chậm hơn
  },
};

export default function () {
  const res = http.get('https://api.example.com/search?q=test');
  check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
  });
  sleep(0.5);
}
```

---

### 3.4. Spike test (Đột biến tải)

**Mục tiêu:**

* Mô phỏng **traffic spike**: 10 → 1000 users trong vài giây (sale, campaign, flash sale…).
* Xem hệ thống có:

  * Sập không?
  * Tự recover được không?

**Đặc điểm:**

* **Tăng cực nhanh** rồi giảm.

**Script example:**

```js
// spike-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 10 },   // warm up nhẹ
    { duration: '10s', target: 500 },  // spike: tăng đột ngột
    { duration: '30s', target: 500 },  // giữ chút
    { duration: '1m', target: 0 },     // giảm về 0
  ],
  thresholds: {
    http_req_failed: ['rate<0.2'],       // spike có thể chấp nhận lỗi cao hơn
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  const res = http.post('https://api.example.com/checkout', JSON.stringify({
    product_id: 123,
    quantity: 1,
  }), { headers: { 'Content-Type': 'application/json' } });

  check(res, {
    'status is 200 or 503': (r) => [200, 503].includes(r.status),
  });

  sleep(1);
}
```

---

### 3.5. Soak test / Endurance test (Chạy dài)

**Mục tiêu:**

* Chạy **dài hàng giờ đến hàng ngày** ở mức tải bình thường.
* Tìm:

  * **Memory leak**,
  * Connection leak,
  * Drift, degrade từ từ.

**Đặc điểm:**

* VUs cố định hoặc ramp nhẹ.
* Duration rất dài (1–24h).

**Script example:**

```js
// soak-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,
  duration: '4h', // ví dụ 4 tiếng
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

export default function () {
  const res = http.get('https://api.example.com/user/profile');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1); // tránh "đập" quá mạnh, gần với usage thật
}
```

---

### 3.6. Breakpoint / Capacity test (Tìm điểm sập / capacity)

**Mục tiêu:**

* Tìm **mức throughput hoặc VUs tối đa** mà hệ thống còn đáp ứng được SLA (VD: p95 < 1s).
* Tăng đần hoặc dùng arrival-rate executor.

**Cách làm:**

* Dùng `stages` **hoặc** `scenarios` với `ramping-arrival-rate`.
* Quan sát khi nào:

  * Error rate tăng mạnh
  * Response time p95/p99 tăng đột biến → đó là near-breakpoint.

**Script example (ramping arrival rate):**

```js
// capacity-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    capacity_test: {
      executor: 'ramping-arrival-rate',
      startRate: 10,       // 10 requests/second
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 500,
      stages: [
        { duration: '2m', target: 50 },   // 50 req/s
        { duration: '2m', target: 100 },  // 100 req/s
        { duration: '2m', target: 200 },  // 200 req/s
        { duration: '2m', target: 300 },  // 300 req/s
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1000'], // SLA của bạn
  },
};

export default function () {
  const res = http.get('https://api.example.com/search?q=capacity');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(0.1);
}
```
