Skrypt `../schema.sql` jest transakcyjnym skryptem inicjalizującym nowy projekt Supabase.

Gdy korzystasz z Supabase CLI, wygeneruj nazwę migracji przez CLI (nie wpisuj ręcznie znacznika czasu):

```powershell
npx supabase --help
npx supabase init
npx supabase migration new tracker_schema
$migration = Get-ChildItem supabase/migrations -Filter '*_tracker_schema.sql' | Sort-Object Name | Select-Object -Last 1
Copy-Item -LiteralPath supabase/schema.sql -Destination $migration.FullName
```

Wybierz SQL Editor albo CLI jako jedną ścieżkę inicjalizacji. Nie uruchamiaj ponownie skryptu na utworzonej bazie.
