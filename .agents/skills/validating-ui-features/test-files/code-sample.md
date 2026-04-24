# Expected Code Block Output

When the agent returns code, verify this structure renders correctly.

## Python Example

The following should render with:
- Language label: "python"
- Copy button in header
- Line numbers 1-10
- Syntax highlighting

```python
def fibonacci(n: int) -> int:
    """Calculate the nth Fibonacci number.
    
    Args:
        n: The position in the Fibonacci sequence (0-indexed)
        
    Returns:
        The nth Fibonacci number
    """
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)


# Test the function
for i in range(10):
    print(f"F({i}) = {fibonacci(i)}")
```

### Expected Syntax Highlighting

| Element | Color | Examples |
|---------|-------|----------|
| Keywords | Purple/Blue | `def`, `return`, `if`, `for`, `in` |
| Strings | Orange | `"Calculate..."`, `f"F({i})..."` |
| Comments | Green | `# Test the function` |
| Function names | Yellow | `fibonacci`, `print` |
| Types | Cyan | `int` |
| Numbers | Light green | `1`, `10` |

---

## TypeScript Example

```typescript
interface UserProfile {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
    language: string;
  };
  roles: string[];
}

async function fetchUser(id: string): Promise<UserProfile | null> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return null;
  }
}
```

---

## Bash Example

```bash
#!/bin/bash
# PostgreSQL backup script with timestamp

DB_NAME="myapp_production"
BACKUP_DIR="/var/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "Starting backup of ${DB_NAME}..."
pg_dump -U postgres -h localhost "${DB_NAME}" | gzip > "${BACKUP_DIR}/${FILENAME}"

if [ $? -eq 0 ]; then
    echo "Backup completed: ${FILENAME}"
else
    echo "Backup failed!" >&2
    exit 1
fi
```

---

## SQL Example

```sql
-- Find customers with duplicate email addresses
WITH duplicate_emails AS (
    SELECT 
        email,
        COUNT(*) as occurrence_count
    FROM customers
    GROUP BY email
    HAVING COUNT(*) > 1
)
SELECT 
    c.id,
    c.name,
    c.email,
    c.created_at,
    de.occurrence_count
FROM customers c
INNER JOIN duplicate_emails de ON c.email = de.email
ORDER BY c.email, c.created_at;
```

---

## Verification Checklist

For each code block above, verify:

- [ ] Dark background container
- [ ] Language label in top-left of header
- [ ] "Copy" button in top-right of header
- [ ] Line numbers visible on left
- [ ] Syntax highlighting applied (colors match theme)
- [ ] Long lines wrap without horizontal scroll
- [ ] Click "Copy" → code copied to clipboard
