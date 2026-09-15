# Deploying the Frontend to IIS

This app is a **Vite + React single-page application (SPA)** with client-side
routing (React Router) and a relative API base URL (`/api`, see
`src/services/api.ts`). During development the Vite dev server proxies `/api`
and `/uploads` to the backend (see `vite.config.ts`). In production on IIS that
proxy job is done by **IIS URL Rewrite + ARR** instead.

---

## 1. Build the production bundle

```bash
npm install
npm run build
```

This runs `tsc -b && vite build` and produces a `dist/` folder containing:

- `index.html`
- hashed JS/CSS under `assets/`
- `web.config` (copied from `public/web.config` — SPA fallback + proxy rules)
- `favicon.svg`, `icons.svg`

> **Sub-path hosting:** the app is built with the default base `/`. Deploy it as
> the root of an IIS site (e.g. `http://server/`), not under a sub-application
> like `http://server/frontend/`. If you must use a sub-path, set
> `base: '/frontend/'` in `vite.config.ts` and adjust the fallback rewrite
> accordingly.

## 2. Prepare the IIS server (one time)

Install these free Microsoft modules on the server:

| Module | Purpose | Link |
|---|---|---|
| **URL Rewrite 2.1** | SPA fallback routing (mandatory) | <https://www.iis.net/downloads/microsoft/url-rewrite> |
| **ARR 3.0** | Reverse proxy `/api` + `/uploads` to the backend | <https://www.iis.net/downloads/microsoft/application-request-routing> |

After installing ARR, enable the proxy **once at server level**:

1. IIS Manager → click the **server node** (top of the tree).
2. **Application Request Routing Cache** → **Server Proxy Settings…**
3. Tick **Enable proxy** → **Apply**.

### Disable WebDAV (mandatory)

If the **WebDAV Publishing** Windows feature is installed, `WebDAVModule` claims
the `PUT`, `DELETE` and `PROPFIND` verbs and answers them with
`405 Method Not Allowed` (`Allow: GET, HEAD, OPTIONS, TRACE`) **before** URL
Rewrite/ARR or the API ever see the request. `GET`, `POST` and even `PATCH` keep
working, so the app looks healthy while every update and delete silently fails.

Both `web.config` files in this repo already remove it:

```xml
<modules><remove name="WebDAVModule" /></modules>
<handlers><remove name="WebDAV" /></handlers>
```

It must be removed on **both** sites — the SPA site rejects the proxied request
before it reaches the API site. The cleanest alternative is to uninstall the
feature entirely: *Turn Windows features on or off → Internet Information
Services → World Wide Web Services → Common HTTP Features → **WebDAV
Publishing*** (untick), then `iisreset`.

Verify from any machine that can reach the server:

```bash
curl -i -X PUT -H "Content-Type: application/json" -d "{}" http://192.168.1.34:81/api/system/config
```

Expect `401 Unauthorized` with `WWW-Authenticate: Bearer` (the request reached
the API). A `405` with an IIS HTML body means WebDAV is still intercepting it.

If your backend is an ASP.NET Core app you can alternatively host it in IIS as
its own site/app and skip the proxy rules entirely (see *Option B* below).

## 3. Create the IIS site

1. Copy the `dist/` folder to the server, e.g. `C:\inetpub\promotion-admin`.
2. IIS Manager → right-click **Sites** → **Add Website**:
   - **Site name:** `PromotionAdmin`
   - **Physical path:** `C:\inetpub\promotion-admin`
   - **Binding:** e.g. port `80` (or `3000`, or a hostname + 443)
3. Select the site's **Application Pool** and set **.NET CLR version** to
   **No Managed Code** (this is a static site — no .NET runtime needed).
4. Verify the app pool identity (`IIS AppPool\PromotionAdmin`) has **Read**
   NTFS permission on the folder. `C:\inetpub` normally already grants this via
   `IIS_IUSRS`.

## 4. Point the proxy at your backend

Edit `web.config` inside the deployed folder (and keep `public/web.config` in
the repo in sync) — both reverse-proxy rules currently target:

```
http://192.168.1.34:81
```

Change the host/port in the two `<action type="Rewrite" ...>` URLs if your
backend lives elsewhere.

## 5. Verify

| Test | Expected |
|---|---|
| `http://server/` | Login page loads |
| Refresh on a deep link, e.g. `http://server/questions/mcq` | Page still loads (SPA fallback works) |
| `http://server/api/...` (open a known endpoint in browser) | JSON response from the backend (proxy works) |
| Login flow | Token stored in `sessionStorage`, no CORS errors |

### Troubleshooting

- **405 on any save/delete, but reads work** — WebDAV is intercepting `PUT`/`DELETE`;
  see *Disable WebDAV* in step 2. Affects System Configuration save, and the
  delete actions on questions, flowpaths and registrations.
- **Gemini returns `401 … Expected OAuth 2 access token`** — an `Authorization`
  header is reaching Google, which makes it ignore the API key completely. The
  API key itself is not the problem. Check for an intercepting proxy on the
  server's outbound path and confirm the deployed build is current.
- **500.52 / 500.53 on `/api`** — ARR server proxy not enabled (step 2) or
  backend unreachable from the IIS server. Test with
  `Invoke-WebRequest http://192.168.1.34:81/api/...` on the server itself.
- **404 on refresh of deep links** — URL Rewrite module not installed, or the
  `web.config` didn't make it into the deployed folder.
- **Blank page / broken assets under a sub-path** — see the *Sub-path hosting*
  note in step 1.
- **CORS errors in browser console** — the proxy isn't handling `/api`; the app
  must call same-origin `/api` for the proxy design to work.

## Option B — backend hosted in IIS as well

If your backend is an ASP.NET Core app, you can host everything under one site
without ARR:

```
Site (PromotionAdmin)  ->  C:\inetpub\promotion-admin        (this SPA, dist)
  └─ /api  application ->  C:\inetpub\promotion-api          (backend publish)
```

Publish the backend with `dotnet publish`, add it as an **application** named
`api` under the site, and remove the two reverse-proxy rules from `web.config`
(keep the SPA fallback). Do the same for `/uploads` if the backend serves
uploaded files directly.
