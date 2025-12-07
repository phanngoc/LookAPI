# Research.

## K6 SharedArray

✅ Load Testing / Performance Testing
javascript// Test với 10,000 unique users, 1000 VUs concurrent
const users = new SharedArray('users', function () {
  return JSON.parse(open('./10k_users.json')); // 10MB file
});

export const options = {
  vus: 1000,
  duration: '10m',
};

🎯 Cần scale lớn (1000+ concurrent users)
🎯 Performance/Load testing
🎯 Memory efficiency quan trọng
🎯 CI/CD automation với data lớn
🎯 Static test data

```javascript
// 2. K6: Load testing với data từ Apidog
import { SharedArray } from 'k6/data';

const validUsers = new SharedArray('valid_users', function () {
  // Data đã được validate bởi Apidog
  return JSON.parse(open('./apidog_export_users.json'));
});

export default function () {
  const user = validUsers[__ITER % validUsers.length];
  
  // Test với data đã biết là valid
  const res = http.post('https://api.example.com/login', {
    email: user.email,
    password: user.password,
  });
  
  check(res, {
    'login successful': (r) => r.status === 200,
    'response time OK': (r) => r.timings.duration < 500,
  });
}
```
## Apidog Data Passing thắng khi:

🎯 API development & debugging
🎯 Functional testing
🎯 Dynamic data generation
🎯 Visual workflow preferred
🎯 Quick iterations
🎯 Small to medium datasets

## Tasks:
Nghiên cứu cách drill dùng yaml file để viết flow test senarios testing.
Tìm hiệu và thử nghiệm tích hợp có thể export + import test scenarios qua yaml file (giống cách drill sử dụng, nhưng không dùng drill). Qua đó có thể giúp các AI (như copilot + claude code) generate test scenarios từ API spec.

## Ref:
- https://docs.apidog.com/performance-testing-603638m0
- https://github.com/fcsonline/drill?tab=readme-ov-file
- https://github.com/grafana/k6
