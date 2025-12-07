

# 1️⃣ `serde_yaml` là gì (hiểu nhanh)

`serde_yaml` = YAML ↔ Rust data structure

Nó **không phải formatter chuyên dụng**, nhưng:
✅ Parse YAML
✅ Validate syntax
✅ Normalize (auto-correct indent, spacing, style)
❌ Mất comment / anchor / alias

👉 Rất phù hợp cho **auto-fix YAML lỗi nhẹ + chuẩn hóa**

---

# 2️⃣ Cài đặt

```toml
# Cargo.toml
[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_yaml = "0.9"
```

---

# 3️⃣ Dùng cơ bản nhất (Parse + Serialize)

### ✅ Correct YAML bằng re-serialize

```rust
use serde_yaml::Value;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let input = r#"
a:
  b:    1
  c:
    -    2
    -3
"#;

    let v: Value = serde_yaml::from_str(input)?;
    let output = serde_yaml::to_string(&v)?;

    println!("{}", output);
    Ok(())
}
```

👉 YAML đầu ra sẽ:

* indent chuẩn
* spacing chuẩn
* syntax chắc chắn hợp lệ

---

# 4️⃣ Deserialize YAML thành Struct (an toàn nhất)

### ✅ Khi bạn biết schema

```rust
use serde::{Deserialize};

#[derive(Debug, Deserialize)]
struct Config {
    host: String,
    port: u16,
}
```

```rust
let yaml = r#"
host: localhost
port: 8080
"#;

let cfg: Config = serde_yaml::from_str(yaml)?;
```

💡 Lợi ích:

* ✅ Validate kiểu
* ✅ Bắt lỗi ngay khi parse
* ✅ Rất tốt cho CI / config

---

# 5️⃣ Serialize Struct → YAML (auto-correct cực mạnh)

```rust
use serde::Serialize;

#[derive(Serialize)]
struct Config {
    host: String,
    port: u16,
}

let cfg = Config {
    host: "localhost".to_string(),
    port: 8080,
};

let yaml = serde_yaml::to_string(&cfg)?;
println!("{}", yaml);
```

👉 YAML output **luôn hợp lệ + đẹp**

---

# 6️⃣ Edit YAML động bằng `Value` (quan trọng)

### ✅ Khi YAML không có schema cố định

```rust
use serde_yaml::Value;

let mut doc: Value = serde_yaml::from_str(input)?;

// Modify
doc["server"]["port"] = Value::from(9000);

// Add
doc["debug"] = Value::from(true);

let fixed_yaml = serde_yaml::to_string(&doc)?;
```

👉 Case này **dùng rất nhiều trong YAML editor / auto-fix**

---

# 7️⃣ Dùng để Auto-correct file YAML

### ✅ CLI công cụ fix YAML

```rust
use std::fs;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let content = fs::read_to_string("input.yaml")?;
    let value: serde_yaml::Value = serde_yaml::from_str(&content)?;
    let fixed = serde_yaml::to_string(&value)?;
    fs::write("input.yaml", fixed)?;
    Ok(())
}
```

✅ Fix:

* indent lỗi
* spacing
* list / map format
* key thiếu space

❌ Không fix:

* semantic error
* missing required key

---

# 8️⃣ Catch lỗi YAML đẹp cho user

```rust
match serde_yaml::from_str::<Value>(content) {
    Ok(v) => { /* OK */ }
    Err(e) => {
        eprintln!("YAML error: {}", e);
    }
}
```

📌 Error message của `serde_yaml` **đủ tốt để hiển thị UI**

---

# 9️⃣ Những BUG / LIMIT cần nhớ (rất quan trọng)

❌ Mất comment:

```yaml
# comment này sẽ mất
```

❌ Anchor & alias:

```yaml
a: &x 1
b: *x
```

❌ Thứ tự key có thể đổi

👉 **KHÔNG dùng nếu comment là critical**

---

# 🔥 Best Practice (kinh nghiệm thực tế)

### ✅ Dùng `serde_yaml` khi:

* config
* CI/CD
* OpenAPI sau khi generate
* k8s manifest machine-generated
* auto-fix lỗi nhẹ

### ❌ Không dùng khi:

* YAML viết tay nhiều comment
* Helm chart
* Doc YAML

---

# 10️⃣ TL;DR

| Mục tiêu            | serde_yaml có phù hợp?  |
| ------------------- | ----------------------- |
| Validate YAML       | ✅                       |
| Auto-correct indent | ✅                       |
| Format đẹp          | ✅                       |
| Giữ comment         | ❌                       |
| Schema-aware        | ✅                       |
| Editor tooling      | ✅ (kết hợp parser khác) |

