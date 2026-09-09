import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

// Usa apenas um DEV já iniciado manualmente. Toda API é interceptada antes de chegar ao backend.
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = new URL(process.env.CMS_NOTIFICATION_TEST_URL ?? "http://127.0.0.1:35013");
assert(["localhost", "127.0.0.1"].includes(origin.hostname) && origin.port === "35013" && origin.protocol === "http:", "Use somente o DEV local do CMS na porta 35013.");
await fetch(new URL("/admin/auth/entrar", origin), { signal: AbortSignal.timeout(20000) });
const browserPath = process.env.CMS_TEST_BROWSER_PATH ?? [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/chromium", "/usr/bin/google-chrome",
].find((candidate) => existsSync(candidate));
assert(browserPath && existsSync(browserPath), "Defina CMS_TEST_BROWSER_PATH para Chrome/Edge/Chromium instalado.");
const profile = mkdtempSync(path.join(frontend, ".next.notification-test-"));
const browser = spawn(browserPath, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
let socket;
let browserError;
browser.on("error", (error) => { browserError = error; });

async function until(check, label, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (browserError) throw browserError;
    const result = await check();
    if (result) return result;
    await delay(100);
  }
  throw new Error(`Tempo esgotado: ${label}`);
}

try {
  const portFile = path.join(profile, "DevToolsActivePort");
  await until(() => existsSync(portFile), "iniciar navegador isolado");
  const debugPort = Number(readFileSync(portFile, "utf8").split("\n")[0]);
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let sequence = 0;
  const pending = new Map();
  const failures = [];
  function cdp(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP: ${method}`)); }, 30000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  let saveFails = false;
  let saves = 0;
  let uploaded = false;
  const homePage = JSON.parse(readFileSync(path.resolve(frontend, "../../site/backend/storage/content.json"), "utf8")).homePage;
  let items = [{ id: "notification-fixture", order: 1, title: "Certificação de teste", alt: "Logo de teste", image: "" }];
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";

  async function intercept({ requestId, request, resourceType }) {
    const url = new URL(request.url);
    const fulfill = (body, status = 200, type = "application/json") => cdp("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: [{ name: "Content-Type", value: type }], body: Buffer.from(typeof body === "string" ? body : JSON.stringify(body)).toString("base64") });
    if (url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/auth/session") return fulfill({ authenticated: true, csrfToken: "notification-test-only", user: { id: "fixture", email: "fixture@example.invalid", role: "admin", cmsTheme: "dark", cmsPermissions: ["home", "units", "images"] } });
      if (url.pathname === "/api/admin/home") return fulfill({ homePage });
      if (url.pathname === "/api/admin/home/certifications/media") {
        assert.equal(request.method, "POST");
        assert.equal(request.headers["X-CSRF-Token"] ?? request.headers["x-csrf-token"], "notification-test-only");
        uploaded = true;
        return fulfill({ image: { id: "test-image", url: "/uploads/notification-test.png", name: "logo-teste.png", mediaType: "image" } });
      }
      if (url.pathname === "/api/admin/home/certifications") {
        if (request.method === "PUT") {
          saves++;
          if (saveFails) return fulfill({ error: "Falha de teste ao salvar. Tente novamente." }, 400);
          items = JSON.parse(request.postData).items;
        }
        return fulfill({ items, images: [] });
      }
      return fulfill({ items: [], images: [] });
    }
    if (url.pathname.startsWith("/uploads/")) return cdp("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "image/png" }], body: png });
    // Previews públicos e recursos externos não participam desta regressão nem recebem requisições.
    if (url.origin !== origin.origin || (resourceType === "Document" && !url.pathname.startsWith("/admin/"))) return fulfill("", 200, "text/html");
    if (!["GET", "HEAD"].includes(request.method)) throw new Error("Mutação não interceptada: teste abortado.");
    return cdp("Fetch.continueRequest", { requestId });
  }

  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const operation = pending.get(message.id);
      if (!operation) return;
      pending.delete(message.id);
      clearTimeout(operation.timer);
      if (message.error) operation.reject(new Error(message.error.message)); else operation.resolve(message.result);
    } else if (message.method === "Fetch.requestPaused") {
      void intercept(message.params).catch(async (error) => { failures.push(error.message); await cdp("Fetch.failRequest", { requestId: message.params.requestId, errorReason: "Aborted" }); });
    } else if (message.method === "Runtime.exceptionThrown") {
      failures.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    }
  });
  async function evaluate(expression) {
    const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  }
  const query = (selector) => `document.querySelector(${JSON.stringify(selector)})`;
  const notice = ".cms-notification";
  const save = `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Salvar certificações')`;
  async function waitNotice(tone, text) {
    await until(() => evaluate(`${query(notice)}?.dataset.tone === ${JSON.stringify(tone)} && ${query(notice)}.textContent.includes(${JSON.stringify(text)})`), `aviso ${tone}`);
    await delay(300);
  }
  async function assertVisible(width) {
    const geometry = await evaluate(`(() => { const el = ${query(notice)}, r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, height: innerHeight, front: document.elementFromPoint(r.x + 30, r.y + 30)?.closest('.cms-notification') === el, position: getComputedStyle(el.parentElement).position, overflow: el.scrollWidth > el.clientWidth }; })()`);
    assert.equal(geometry.position, "fixed");
    assert(geometry.y >= 0 && geometry.y < 30 && geometry.x >= 0 && geometry.right <= width && geometry.bottom <= geometry.height, JSON.stringify(geometry));
    assert(geometry.front && !geometry.overflow, "Aviso encoberto ou transbordando.");
  }
  async function screenshot(name) {
    if (process.env.CMS_NOTIFICATION_TEST_SCREENSHOTS !== "1") return;
    const output = path.join(frontend, ".next.test");
    mkdirSync(output, { recursive: true });
    const result = await cdp("Page.captureScreenshot", { format: "png" });
    writeFileSync(path.join(output, `notification-${name}.png`), Buffer.from(result.data, "base64"));
  }

  await cdp("Page.enable");
  await cdp("Runtime.enable");
  // O headless pode alterar activeElement sem emitir focusin se a janela não tiver foco.
  await cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
  await cdp("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1920, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.navigate", { url: new URL("/admin/developer/home", origin).href });
  await until(() => evaluate(`Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === '4Certificações')`), "carregar Home", 60000);
  await until(() => evaluate(`document.querySelectorAll('nav[aria-label="Etapas do editor da Home"] button').length === 9`), "preencher etapas na tela larga");
  const widePagination = await evaluate(`(() => { const nav = document.querySelector('nav[aria-label="Etapas do editor da Home"]'); return { paginated: Boolean(document.querySelector('[aria-label="Mostrar próximas etapas"]')), width: nav.clientWidth, pageSizes: Array.from(nav.children[0].children).map(page => page.querySelectorAll('button').length) }; })()`);
  assert.equal(widePagination.paginated, false, `Não deve paginar quando as nove etapas cabem: ${JSON.stringify(widePagination)}`);
  const wideSteps = await evaluate(`(() => { const nav = document.querySelector('nav[aria-label="Etapas do editor da Home"]'); const navBox = nav.getBoundingClientRect(); return Array.from(nav.querySelectorAll('button')).map(button => { const box = button.getBoundingClientRect(); return { left: box.left, right: box.right, navLeft: navBox.left, navRight: navBox.right }; }); })()`);
  assert(wideSteps.every((step) => step.left >= step.navLeft && step.right <= step.navRight), "Uma etapa larga foi cortada.");
  assert(Math.abs(wideSteps.at(-1).right - wideSteps.at(-1).navRight) < 2, "As etapas completas não usaram o espaço lateral disponível.");
  const wideTitleOverflow = await evaluate(`Array.from(document.querySelectorAll('nav[aria-label="Etapas do editor da Home"] button span:last-child')).map(label => ({ title: label.textContent, client: label.clientWidth, scroll: label.scrollWidth })).filter(label => label.scroll > label.client)`);
  assert.equal(wideTitleOverflow.length, 0, `O título de uma etapa foi truncado: ${JSON.stringify(wideTitleOverflow)}`);
  await screenshot("home-steps-wide");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1024, height: 900, deviceScaleFactor: 1, mobile: false });
  await until(() => evaluate(`Boolean(document.querySelector('[aria-label="Mostrar próximas etapas"]'))`), "paginar somente quando necessário");
  const narrowSteps = await evaluate(`(() => { const nav = document.querySelector('nav[aria-label="Etapas do editor da Home"]'); const navBox = nav.getBoundingClientRect(); return Array.from(nav.querySelectorAll('button')).map(button => { const box = button.getBoundingClientRect(); return { visible: box.right > navBox.left && box.left < navBox.right, contained: box.left >= navBox.left && box.right <= navBox.right, right: box.right, navRight: navBox.right }; }).filter(step => step.visible); })()`);
  assert(narrowSteps.length > 0 && narrowSteps.every((step) => step.contained), "A paginação exibiu uma aba parcial.");
  assert(Math.abs(narrowSteps.at(-1).right - narrowSteps.at(-1).navRight) < 2, "A página atual não usou o espaço lateral disponível.");
  await screenshot("home-steps-paginated");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1920, height: 900, deviceScaleFactor: 1, mobile: false });
  await until(() => evaluate(`!document.querySelector('[aria-label="Mostrar próximas etapas"]')`), "remover paginação ao recuperar espaço");
  await evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '4Certificações').click()`);
  await until(() => evaluate(`Boolean(${save})`), "abrir certificações");
  await evaluate(`${save}.scrollIntoView({block:'center'})`);
  const scrollBefore = await evaluate(`${query("[data-admin-scroll]")}.scrollTop`);
  assert(scrollBefore > 0, "O teste exige a página rolada.");

  await evaluate(`(() => { const input = document.querySelector('input[type=file][accept*=image]'); const transfer = new DataTransfer(); transfer.items.add(new File([Uint8Array.from(atob('${png}'), c => c.charCodeAt(0))], 'logo-teste.png', { type: 'image/png' })); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await waitNotice("success", "Logo enviado");
  assert(uploaded && saves === 0, "Enviar logo não pode salvar certificações.");
  await assertVisible(1920);
  await screenshot("desktop");
  assert(Math.abs(await evaluate(`${query("[data-admin-scroll]")}.scrollTop`) - scrollBefore) < 2, "Aviso mudou a rolagem.");
  await evaluate(`${query(".cms-notification__close")}.click()`);
  await until(() => evaluate(`!${query(notice)}`), "fechar aviso");
  assert.equal(saves, 0, "Fechar aviso submeteu o formulário.");

  await evaluate(`${save}.click()`);
  await waitNotice("success", "Certificações salvas");
  assert.equal(items[0].image, "/uploads/notification-test.png");
  const firstId = await evaluate(`${query(".cms-notification__text")}.id`);
  await evaluate(`${save}.click()`);
  await waitNotice("success", "Certificações salvas");
  await until(async () => saves === 2 && await evaluate(`${query(".cms-notification__text")}?.id !== ${JSON.stringify(firstId)}`), "renovar aviso após resposta repetida");
  assert.equal(await evaluate(`document.querySelectorAll('${notice}').length`), 1);
  await evaluate(`${query(".cms-notification__close")}.focus()`);
  await until(() => evaluate(`document.activeElement === ${query(".cms-notification__close")}`), "focar fechamento do aviso");
  await delay(8500);
  assert(await evaluate(`Boolean(${query(notice)})`), "Aviso expirou durante leitura com foco.");
  await evaluate(`${query(".cms-notification__close")}.blur()`);
  await until(() => evaluate(`!${query(notice)}`), "fechamento automático", 12000);

  saveFails = true;
  await evaluate(`${save}.click()`);
  await waitNotice("error", "Falha de teste");
  assert(await evaluate(`Boolean(${query(".cms-notification [role=alert]")})`));
  await delay(8500);
  assert(await evaluate(`Boolean(${query(notice)})`), "Erro não deve sumir automaticamente.");
  await evaluate(`${query('[aria-label^="Trocar mídia:"]')}.click()`);
  await until(() => evaluate(`Boolean(${query('[data-media-library-dialog="true"]')})`), "abrir biblioteca sobre o editor");
  await assertVisible(1920);
  await evaluate(`${query(".cms-notification__close")}.focus()`);
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
  await until(() => evaluate(`!${query(notice)}`), "fechar aviso sobre modal");
  assert(await evaluate(`Boolean(${query('[data-media-library-dialog="true"]')})`), "Escape do aviso também fechou o modal.");
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
  await until(() => evaluate(`!${query('[data-media-library-dialog="true"]')}`), "fechar biblioteca");
  await evaluate(`${save}.click()`);
  await waitNotice("error", "Falha de teste");
  await evaluate(`${query('[aria-label="Ativar modo claro"]')}.click()`);
  assert.equal(await evaluate(`getComputedStyle(${query(notice)}).backgroundColor`), "rgb(255, 241, 242)");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(300);
  await assertVisible(390);
  await screenshot("mobile");
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  assert.equal(await evaluate(`getComputedStyle(${query(notice)}).animationName`), "none");
  await evaluate(`${query(".cms-notification__close")}.focus()`);
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
  await until(() => evaluate(`!${query(notice)}`), "fechar pelo teclado");
  await evaluate(`${save}.click()`);
  await waitNotice("error", "Falha de teste");
  await evaluate(`document.querySelector('a[href="/admin/developer/unidades"]').click()`);
  await until(() => evaluate(`location.pathname.endsWith('/unidades') && !${query(notice)}`), "limpar aviso ao navegar");
  assert.deepEqual(failures, []);
  console.log("PASS: abas da Home usam toda a largura antes de paginar, sem etapa parcial; upload sem publicação, referência preservada ao salvar, aviso fixo sem mudar rolagem, repetição, fechamento sem submit, pausa por foco, expiração de sucesso, erro persistente, temas, mobile, movimento reduzido, Escape isolado do modal, sobreposição e navegação. APIs simuladas; nenhum storage alterado.");
} finally {
  socket?.close();
  // Encerra somente o navegador criado por este teste, nunca os processos DEV.
  if (browser.exitCode === null) browser.kill();
  await delay(1000);
  const resolvedProfile = realpathSync(profile);
  assert(path.dirname(resolvedProfile).toLowerCase() === realpathSync(frontend).toLowerCase() && path.basename(resolvedProfile).startsWith(".next.notification-test-"));
  rmSync(resolvedProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}
