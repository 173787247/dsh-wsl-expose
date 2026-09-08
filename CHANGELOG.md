# Changelog

## 0.2.2

- Advice: open the `restart-dsh-web.sh` `:3081/?token=` URL (dsh ≥0.1.2; bare :3081 is 401).

## 0.2.1

- Advice: run `check-dsh-health` + `port_doctor` on 3080/3081 before portproxy; local UI uses :3081 relay.

## 0.2.0

- Read `networkingMode` from Windows `.wslconfig`.
- Prefer kit `:3081` relay for dsh; remove incorrect “bind dsh to 0.0.0.0” advice.
- Expose `browserHint` in tool output.

## 0.1.0

- Initial portproxy advise/apply.
