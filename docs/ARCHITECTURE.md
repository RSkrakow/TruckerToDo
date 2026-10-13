# Tracker To Do — architektura

## Przepływ

1. Przeglądarka z uwierzytelnioną sesją przesyła plik bezpośrednio do prywatnego bucketu `notes` pod `user_id/random_uuid.ext`.
2. `POST /api/notes` potwierdza dostęp do pliku i zapisuje notatkę. Nie uruchamia analizy.
3. Użytkownik wybiera „Uruchom analizę AI”. `begin_analysis` serializuje próby użytkownika i rejestruje limit 30/24 h. Po 3 minutach można ponowić zawieszoną próbę.
4. Backend pobiera dokument i kontekst przez sesję użytkownika, z RLS. Obrazy/PDF trafiają do multimodalnego modelu, DOCX do ekstrakcji tekstu Mammoth (bez OCR, HTML ani wykonywania makr).
5. Responses API zwraca JSON Schema. Zod sprawdza wynik, aplikacja sprawdza obszary/osoby/duplikaty. `stage_note` zapisuje propozycje i stan `review` w jednej transakcji.
6. Użytkownik edytuje propozycje i wybiera dodanie, powiązanie z istniejącym wpisem lub pominięcie. `approve_note` blokuje notatkę i zatwierdza wszystkie decyzje atomowo. Ponowne kliknięcie po udanej akceptacji nie tworzy wpisów ponownie.
7. Triggery zapisują audyt i powiadomienia w kolejce. Server Action uruchamia dispatcher po odpowiedzi; Vercel Cron ponawia niewysłane powiadomienia.

## Uzupełnienia modelu

- `area_members` — relacja obszar/użytkownik, bez niej nie można bezpiecznie egzekwować ról z wymagania.
- `items.created_by`, `approved_at` — własność propozycji, rozróżnienie od zaakceptowanych wpisów.
- `item_sources` — wiele notatek może być źródłem tego samego wpisu; powiązanie nie nadpisuje istniejącej treści.
- `suggested_duplicate_id`, `duplicate_reason` — propozycja AI, nie automatyczne scalanie.
- `notes_history.meeting_key`, `processing_state`, `processing_started_at`, `manual_text` — ręczny proces, wspólny identyfikator spotkania, odzyskiwanie przerwanej analizy.
- `analysis_runs` — nieusuwalna dla użytkownika ewidencja limitu wywołań AI.
- `notification_outbox` — kolejka tylko dla serwera, dzierżawa do obsługi równoległych dispatcherów, backoff.

`file_url` przechowuje ścieżkę obiektu, a nie publiczny lub długowieczny URL. Podgląd używa signed URL ważnego 15 minut.

## Uprawnienia

| Działanie | Admin | Manager | Member |
|---|---|---|---|
| Czytanie zaakceptowanych wpisów | Wszystkie | Swoje obszary lub przypisane do siebie | Swoje obszary lub przypisane do siebie |
| Czytanie propozycji | Wszystkie | Własne | Własne |
| Zmiana statusu widocznego wpisu | Tak | Tak | Tak |
| Edycja treści / obszaru / osoby / terminu | Wszystkie | W zarządzanym obszarze | Własne propozycje przed akceptacją |
| Dodanie wpisu | Wszystkie obszary | Przypisane obszary | Przypisane obszary |
| Zarządzanie rolami / członkostwem | Tak | Nie | Nie |
| Czytanie dokumentu źródłowego | Wszystkie | Własne notatki | Własne notatki |

Rola `manager` nadaje zarządzanie każdym obszarem, do którego przypisano użytkownika. Osoba przypisana do zadania musi należeć do jego obszaru. Źródło może zawierać informacje z wielu obszarów, dlatego nie jest udostępniane automatycznie wszystkim czytelnikom pojedynczego zadania. Audyt nie udostępnia treści innych wpisów.

## Granice implementacji

- PWA działa online; offline dostępny jest komunikat i ponowienie połączenia. Brak cache prywatnych zadań i dokumentów, brak kolejki zapisów offline.
- AI porównuje do 500 ostatnich dostępnych wpisów (w tym ręcznych); globalny indeks unikalny dodatkowo blokuje identyczny tytuł w tym samym obszarze i rodzaju. Nie ma gwarancji rozpoznania każdego semantycznego duplikatu. Po zwiększeniu liczby wpisów dodaj wyszukiwanie kandydatów przez pg_trgm/embeddingi z RLS.
- Powiązanie źródła nie zmienia istniejących terminów ani osoby. Uzupełnienia ustaleń edytuje manager/admin na karcie wpisu.
- Powiadomienia mają gwarancję prób dostarczenia „co najmniej raz”: awaria po odbiorze przez Teams i przed potwierdzeniem bazy może skutkować duplikatem. Id zdarzenia w karcie pozwala go rozpoznać.
- Jeden skonfigurowany kanał Teams otrzymuje wszystkie zatwierdzone zadania. Kanał powinien mieć odbiorców uprawnionych do tego zakresu. Dla oddzielnych zespołów rozszerz routing o konfigurację webhooków per obszar przechowywaną wyłącznie po stronie serwera.
- Dashboard ogranicza widok do 500 wpisów; historia notatek do 200 najnowszych. Dla większej skali dodaj paginację i wyszukiwanie serwerowe.
- Nie ma skanowania folderów w tle ani automatycznego OCR. Cron obsługuje wyłącznie kolejkę Teams.

## Zabezpieczenia

Wszystkie tabele aplikacji mają RLS. Role pochodzą z chronionego `profiles`, nie z `user_metadata`. Funkcje uprzywilejowane są prywatne, mają stały `search_path`, brak publicznych uprawnień EXECUTE; ograniczają się do odczytu uprawnień i triggerów. Operacje aplikacji i AI używają sesji użytkownika. Klucz service-role służy tylko dispatcherowi. Nie ma go w kodzie klienta. Auth callback akceptuje wyłącznie dwie stałe ścieżki przekierowania. API mutacji weryfikuje Origin, Server Actions używają ochrony Next.js i RLS. Storage jest prywatny, brak HTML/SVG w uploadzie. Service worker nie cache'uje sesji, API ani plików źródłowych.

## Testowanie

`tests/domain.test.mjs` — powielanie wpisów i walidacja plików, bez zależności zewnętrznych.

`tests/database.test.mjs` — uruchamia rzeczywisty silnik PostgreSQL (PGlite), z minimalnymi atrapami schematów Supabase `auth`/`storage`. Sprawdza RLS, eskalację roli, dokumenty mieszanych obszarów, ograniczenia edycji, audyt, datę wykonania, rollback akceptacji, powtórne kliknięcie i dzierżawę powiadomień. To test logiki PostgreSQL; nie zastępuje testu Supabase Storage i Auth na wdrożonym projekcie.
