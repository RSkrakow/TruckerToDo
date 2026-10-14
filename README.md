# Tracker To Do

Polska aplikacja webowa i mobilna PWA do zadań i ustaleń z ręcznych wpisów, zdjęć oraz PDF/DOCX. Next.js App Router, TypeScript, Tailwind CSS, komponenty shadcn/ui, Supabase PostgreSQL/Auth/Storage, OpenAI Responses API, Teams Workflows i Vercel.

## 1. Uruchomienie lokalne

Wymagany Node.js 24 LTS, npm oraz osobny projekt Supabase.

```powershell
cd tracker-to-do
npm install
Copy-Item .env.example .env.local
# Uzupełnij .env.local lokalnie; nie wysyłaj kluczy w wiadomościach ani do GitHub.
npm run dev
```

Otwórz http://localhost:3000. Bez konfiguracji Supabase zobaczysz ekran konfiguracji. Po pierwszej instalacji zachowaj wygenerowany `package-lock.json` w repozytorium, przejdź na `npm ci` lokalnie i w CI. Wersje zależności są przypięte w package.json.

## 2. Baza i migracja

W **nowym** projekcie Supabase otwórz SQL Editor i wykonaj całą zawartość `supabase/schema.sql` jednorazowo. Skrypt tworzy tabele, obszary, funkcje procesu akceptacji, triggery audytu, RLS i prywatny Storage. Nie uruchamiaj go na „Transport”, „Multijobs” lub innej istniejącej bazie bez wcześniejszego przeglądu kolizji.

Jeśli używasz CLI, instrukcja wygenerowania migracji przez `supabase migration new` jest w `supabase/migrations/README.md`. Użyj jednej ścieżki inicjalizacji. Dalsze zmiany wdrażaj kolejnymi migracjami. W Supabase Data API musi być udostępniony schemat `public`; **nie udostępniaj `private`**.

Po uruchomieniu aplikacji utwórz pierwsze konto. W SQL Editor nadaj mu admina (zastąp adres swoim):

```sql
update public.profiles set role='admin' where email='twoj.adres@firma.pl';
```

Następnie otwórz **Zespół i obszary**. Dodaj uprawnienia obszarów i role istniejącym kontom. Nowe konta domyślnie są memberami bez dostępu do obszarów. Rejestracja nie przyznaje admina na podstawie danych użytkownika. Na produkcji rozważ wyłączenie publicznej rejestracji w Supabase i zapraszanie pracowników przez panel Auth.

## 3. Zmienne środowiskowe

| Zmienna | Zakres | Znaczenie |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Publiczna | URL projektu Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publiczna | Klucz publishable; bezpieczeństwo egzekwuje RLS |
| `NEXT_PUBLIC_APP_URL` | Publiczna | Pełny URL aplikacji bez końcowego `/`, np. https://tracker.firma.pl |
| `GEMINI_API_KEY` | Tylko serwer | **Bezpłatny** klucz z Google AI Studio (zalecany) |
| `GEMINI_MODEL` | Tylko serwer | Model Gemini obsługujący multimodalność i JSON; domyślnie `gemini-1.5-flash` |
| `OPENAI_API_KEY` | Tylko serwer | Alternatywnie klucz API OpenAI z włączonym rozliczaniem |
| `OPENAI_MODEL` | Tylko serwer | Domyślnie `gpt-4.1` (jeśli używany zamiast Gemini) |
| `TEAMS_WEBHOOK_URL` | Tylko serwer | HTTPS webhook Teams Workflows; opcjonalny |
| `SUPABASE_SERVICE_ROLE_KEY` | Tylko serwer | Dispatcher kolejki Teams; nie używa go analiza AI ani zwykły CRUD |
| `CRON_SECRET` | Tylko serwer | Losowy sekret minimum 32 znaki dla `/api/notifications` i Vercel Cron |

Bez klucza AI (Gemini lub OpenAI) działają ręczne wpisy i przechowywanie notatek; analiza zgłasza brak konfiguracji. Bez webhooka zadania zapisują się normalnie, powiadomienia oczekują w kolejce. Ustaw klucze bezpośrednio w Vercel Environment Variables. Nie dodawaj prefiksu `NEXT_PUBLIC_` do sekretów.

## 4. Logowanie Microsoft / Entra ID

1. W Entra ID → App registrations utwórz aplikację, zwykle **single tenant** dla własnej firmy.
2. Ustaw Web Redirect URI na `https://<PROJECT_REF>.supabase.co/auth/v1/callback`.
3. Utwórz Client Secret i wpisz **wartość** sekretu wraz z Application (client) ID w Supabase → Authentication → Sign In / Providers → Azure.
4. W Supabase ustaw tenant URL `https://login.microsoftonline.com/<TENANT_ID>` dla single tenant. Sprawdź polityki administratora organizacji dotyczące zgód aplikacji.
5. W Supabase Auth → URL Configuration ustaw Site URL na produkcyjny URL i dodaj Redirect URLs: `http://localhost:3000/auth/callback`, `https://twoj-host/auth/callback`, a także te same adresy z `?next=/account/password` dla resetu hasła, jeśli konfiguracja wymaga dokładnego dopasowania.
6. Aplikacja używa providera `azure`, żąda scope `email`, obsługuje PKCE i callback z cookie sesji.

Email/Password: włącz provider Email. Na produkcji skonfiguruj SMTP i potwierdzanie adresów. Funkcje odzyskania hasła są na ekranie logowania. Aktualizacja roli działa z tabeli przy kolejnym żądaniu, bez polegania na starych claimach ról JWT.

Dokumentacja: https://supabase.com/docs/guides/auth/social-login/auth-azure oraz https://supabase.com/docs/guides/auth/server-side/creating-a-client

## 5. Notatki i akceptacja

1. **Dodaj nową notatkę** → wybierz dokument, aparat telefonu lub tekst. Mobile capture korzysta z systemowego aparatu; urządzenie może wyświetlić wybór źródła.
2. Plik do 15 MB trafia bezpośrednio do prywatnego Storage. Nazwa i identyfikator spotkania trafiają do `notes_history`.
3. Kliknij **Uruchom analizę AI**. Nie ma automatycznego przetwarzania w tle. Plik i maksymalnie 500 ostatnich widocznych wpisów zostaną wysłane do wybranego modelu AI (Google Gemini lub OpenAI). Ustal w firmie zasady przesyłania treści notatek do tego dostawcy.
4. Sprawdź treść, opis, obszar, osobę i termin. Nieznana osoba pozostaje nieprzypisana. Propozycje mają `pending_approval` i widzi je właściciel/admin.
5. Wybierz **Dodaj nowy wpis**, **Powiąż z istniejącym** lub **Pomiń**. Dla kilku osób na tym samym spotkaniu użyj wspólnego identyfikatora; powiązanie dodaje kolejne źródło do jednego wpisu.
6. Kliknij **Zatwierdź i Dodaj do Trackera**. Jedna transakcja zapisuje decyzje; akceptacja ponowiona po sukcesie nie dodaje wpisów drugi raz.

Indeks bazy blokuje identyczny tytuł w tym samym obszarze i rodzaju także dla wpisów ręcznych i archiwalnych. Jeśli dwie propozycje w jednej notatce mają ten sam tytuł, pomiń jedną lub doprecyzuj treść. AI jedynie sugeruje semantyczne duplikaty — ostateczna decyzja należy do użytkownika.

DOCX analizowany jest tekstowo, bez OCR; osadzone skany i obrazy w DOCX nie są analizowane. Prześlij je osobno jako obraz/PDF. Podgląd DOCX dostępny jest przez pobranie oryginału.

## 6. Teams

W docelowym kanale Teams wybierz **Workflows** i szablon otrzymywania webhooków / publikowania wiadomości po żądaniu webhook. Ustaw kanał, skonfiguruj właściciela i współwłaściciela przepływu, skopiuj URL do `TEAMS_WEBHOOK_URL`. Użyj wariantu zgodnego z żądaniem serwerowym bez interaktywnego logowania; URL stanowi sekret. Kod wysyła `{type:'message', attachments:[AdaptiveCard]}`.

Przy zatwierdzeniu zadania lub zmianie statusu trigger tworzy event w `notification_outbox`. Dispatcher uruchamia się po Server Action. Vercel Cron domyślnie wykonuje codzienny retry o 07:00 UTC; na planie obsługującym częstszy cron możesz zmienić harmonogram na `*/5 * * * *`. Włącz `CRON_SECRET`; Vercel wysyła go jako Authorization Bearer. Endpoint nie analizuje dokumentów.

Kanał musi być odpowiedni dla **wszystkich** zadań objętych webhookiem. Odbiorcy Teams nie podlegają RLS aplikacji. Brak webhooka nie blokuje zapisu. Po jego dodaniu zaległe eventy zostaną wysłane. W SQL Editor sprawdź zaległości:

```sql
select id,item_id,attempts,next_attempt_at,last_error
from public.notification_outbox where delivered_at is null order by created_at;
```

Nie logujemy URL webhooka ani odpowiedzi zawierających sekrety. Teams może otrzymać duplikat po awarii potwierdzenia wysyłki; każda karta zawiera id zdarzenia. Nie używaj wygaszanych konektorów Office 365 jako podstawy nowej integracji.

Dokumentacja: https://support.microsoft.com/en-us/workflows/send-messages-in-teams-using-incoming-webhooks

## 7. GitHub → Vercel

Utwórz **prywatne** repozytorium `tracker-to-do` na GitHub. Po instalacji zależności i przejściu testów:

```powershell
git init
git add .
git commit -m "Build Tracker To Do"
git branch -M main
git remote add origin https://github.com/TWOJ_LOGIN/tracker-to-do.git
git push -u origin main
```

Nie dodawaj .env.local do repozytorium. W Vercel wybierz **Add New → Project → Import Git Repository**, wybierz repozytorium, preset Next.js i Node.js 24. Ustaw powyższe zmienne dla Production; dla Preview użyj osobnego projektu Supabase i sekretów testowych. Wykonaj deploy i dopisz finalny URL callback w Supabase Auth.

Wbudowana integracja Git wdraża main i tworzy preview dla gałęzi. `.github/workflows/ci.yml` sprawdza typy, testy oraz build. Po wygenerowaniu lockfile zmień krok `npm install --ignore-scripts` na `npm ci --ignore-scripts`; pinning wersji i lockfile ograniczają drift. Ustaw wymagane sprawdzenia CI dla main; samo dodanie workflow nie blokuje automatycznej publikacji Vercel, skonfiguruj Deployment Checks jeśli ma czekać na testy.

## 8. PWA i telefon

HTTPS jest wymagany na produkcji. Android/Chrome: menu → „Zainstaluj aplikację” lub „Dodaj do ekranu głównego”. iPhone/Safari: Udostępnij → „Dodaj do ekranu początkowego”. Manifest zawiera ikony 192/512 PNG i tryb standalone. UI jest responsywne, z nawigacją mobilną i wejściem aparatu.

PWA działa online. Offline pokazuje stronę ponowienia połączenia; nie przechowuje prywatnych dokumentów, sesji ani zadań w cache. Nie jest aplikacją natywną dystrybuowaną przez App Store/Google Play.

## 9. Weryfikacja

```powershell
npm run typecheck
npm test
npm run test:db
npm run build
```

Na wdrożonym projekcie przetestuj trzy konta z różnymi rolami: dostęp do obszarów, brak eskalacji roli, prywatność dokumentów, ręczny wpis, JPG/PNG/PDF/DOCX, edycję propozycji, powiązanie duplikatu, historię zmian i datę wykonania. Sprawdź logowanie Azure, reset hasła, webhook i instalację PWA na fizycznym telefonie. Uruchom Security Advisor Supabase; funkcje prywatne RLS i triggery celowo używają kontrolowanego SECURITY DEFINER z ograniczonym EXECUTE i pustym search_path.

Stan weryfikacji podczas przygotowania pakietu: testy domenowe wykonane i zaliczone. Pełny typecheck/build oraz testy PostgreSQL nie zostały wykonane z powodu blokady pobierania zależności npm. Nie zastosowano skryptu w istniejących bazach. Publikacja GitHub/Vercel nie została wykonana (ponowne połączenie GitHub wymagane; utworzenie testowego środowiska Vercel odrzucone przez politykę środowiska).

## Struktura

```text
src/app/                     strony App Router, Server Actions i Route Handlers
  api/notes/                 rejestracja źródła i ręczna analiza AI
  api/notifications/         bezpieczny dispatcher kolejki
  auth/callback/             callback PKCE
  admin/                     role i przypisania obszarów
  items/                     tworzenie i szczegóły z historią
  notes/                     upload, historia i weryfikacja
src/components/              interfejs, formularze, komponenty shadcn/ui
src/lib/                     Supabase SSR, walidacja, reguły domeny i Teams
src/proxy.ts                 odświeżanie sesji i private/no-store
supabase/schema.sql          transakcyjny SQL, RLS, funkcje i triggery
tests/                       reguły domenowe i rzeczywisty PostgreSQL/PGlite
public/                      PWA, ikony i offline fallback
docs/ARCHITECTURE.md          decyzje projektowe i ograniczenia
```
