
## Overview.
Hỗ trợ tính năng upload csv file để tạo ra các request với dữ liệu từ csv file.

CSV support: read CSV files and build N requests fill dynamic interpolations with CSV data.

## Tính năng.
- Upload csv file để tạo ra các request với dữ liệu từ csv file.
- CSV support: read CSV files and build N requests fill dynamic interpolations with CSV data.


## Example.
```yaml
  - name: POST some crafted JSONs stored in CSV, index {{ index }}
    request:
      url: /api/transactions
      method: POST
      body: '{{ item.txn }}'
      headers:
        Content-Type: 'application/json'
    with_items_from_csv:
      file_name: ./fixtures/transactions.csv
      quote_char: "\'"

```
## Ref:
https://github.com/fcsonline/drill?tab=readme-ov-file