var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[Object.keys(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[Object.keys(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  __markAsModule(target);
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __reExport = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, { get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable });
  }
  return target;
};
var __toModule = (module2) => {
  return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? { get: () => module2.default, enumerable: true } : { value: module2, enumerable: true })), module2);
};

// node_modules/@remix-run/dev/compiler/shims/react.ts
var React;
var init_react = __esm({
  "node_modules/@remix-run/dev/compiler/shims/react.ts"() {
    React = __toModule(require("react"));
  }
});

// app/styles/carbonads.css
var require_carbonads = __commonJS({
  "app/styles/carbonads.css"(exports, module2) {
    module2.exports = "/build/_assets/carbonads-Y2IBHSRU.css";
  }
});

// app/server/airtable.ts
async function getSponsorsTable() {
  const base = airtable().base("apppS8mjo4MMR3pif");
  return base("sponsors");
}
async function getTiersTable() {
  const base = airtable().base("apppS8mjo4MMR3pif");
  return base("tiers");
}
var import_airtable, airtable;
var init_airtable = __esm({
  "app/server/airtable.ts"() {
    init_react();
    import_airtable = __toModule(require("airtable"));
    airtable = () => new import_airtable.default({ apiKey: process.env.AIRTABLE_API_KEY });
  }
});

// app/server/github.ts
async function exchangeGithubCodeForToken({ code, state, redirectUrl }) {
  try {
    const { data } = await import_axios.default.post("https://github.com/login/oauth/access_token", {
      client_id: githubClientID,
      client_secret: githubClientSecret,
      code,
      redirect_uri: redirectUrl,
      state
    }, {
      headers: {
        Accept: "application/json"
      }
    });
    return data.access_token;
  } catch (err) {
    console.error(err);
    throw new Error("Unable to authenticate with Github. Please log in again.");
  }
}
var import_axios, import_rest, import_graphql, GITHUB_ORG, octokit, graphqlWithAuth, githubClientID, githubClientSecret;
var init_github = __esm({
  "app/server/github.ts"() {
    init_react();
    import_axios = __toModule(require("axios"));
    import_rest = __toModule(require("@octokit/rest"));
    import_graphql = __toModule(require("@octokit/graphql"));
    GITHUB_ORG = "TanStack";
    octokit = new import_rest.Octokit({
      userAgent: "TanStack.com"
    });
    graphqlWithAuth = import_graphql.graphql.defaults({
      headers: {
        authorization: `token ${process.env.GITHUB_AUTH_TOKEN}`
      }
    });
    githubClientID = "Iv1.3aa8d13a4a3fde91";
    githubClientSecret = "e2340f390f956b6fbfb9c6f85100d6cfe07f29a8";
  }
});

// app/server/tiers.ts
async function getTiersMeta() {
  const tiersTable = await getTiersTable();
  const tiers = await new Promise((resolve, reject) => {
    let allTiers = [];
    tiersTable.select().eachPage(function page(records, fetchNextPage) {
      allTiers = [...allTiers, ...records];
      fetchNextPage();
    }, function done(err) {
      if (err) {
        reject(err);
      } else {
        resolve(allTiers);
      }
    });
  });
  return tiers;
}
async function createTiersMeta(tiersMeta) {
  const tiersTable = await getTiersTable();
  return new Promise((resolve, reject) => {
    tiersTable.create(tiersMeta.map((d) => ({ fields: d })), function(err) {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}
async function getTierById(tierId) {
  const tiers = await getGithubTiers();
  const tier = tiers.find((d) => d.id == tierId);
  if (!tier) {
    throw new Error(`Could not find tier with id: ${tierId}`);
  }
  const tiersMeta = await getTiersMeta();
  const tierMeta = tiersMeta.find((d) => d.fields.id === tierId);
  if (!tierMeta) {
    throw new Error(`Could not find tierMeta with id: ${tierId}`);
  }
  return __spreadProps(__spreadValues({}, tier), {
    meta: tierMeta
  });
}
async function getGithubTiers() {
  const res = await graphqlWithAuth(`query {
      viewer {
        sponsorshipsAsMaintainer(first: 1) {
          nodes {
            sponsorable {
              sponsorsListing {
                tiers(first: 100) {
                  nodes {
                    id
                    name
                    description
                    descriptionHTML
                    monthlyPriceInDollars
                  }
                }
              }
            }
          }
        }
      }
    }`);
  return res.viewer.sponsorshipsAsMaintainer.nodes[0].sponsorable.sponsorsListing.tiers.nodes;
}
async function getGithubTiersWithMeta() {
  const githubTiers = await getGithubTiers();
  const tiersMeta = await getTiersMeta();
  return githubTiers.map((d) => {
    var _a;
    return __spreadProps(__spreadValues({}, d), {
      meta: (_a = tiersMeta.find((meta2) => {
        var _a2;
        return ((_a2 = meta2.fields) == null ? void 0 : _a2.id) == d.id;
      })) == null ? void 0 : _a.fields
    });
  });
}
async function updateTiersMeta(githubTiers) {
  const tiersMeta = await getTiersMeta();
  await Promise.all(tiersMeta.map((tierMeta) => {
    const newTier = githubTiers.find((d) => d.id === tierMeta.fields.id);
    if (newTier) {
      githubTiers = githubTiers.filter((d) => d !== newTier);
      return tierMeta.updateFields({
        name: newTier.name
      });
    }
    return tierMeta.destroy();
  }));
  if (githubTiers == null ? void 0 : githubTiers.length) {
    await createTiersMeta(githubTiers.map((d) => ({ id: d.id, name: d.name })));
  }
}
var init_tiers = __esm({
  "app/server/tiers.ts"() {
    init_react();
    init_airtable();
    init_github();
  }
});

// app/server/sponsors.ts
var sponsors_exports = {};
__export(sponsors_exports, {
  getSponsorsAndTiers: () => getSponsorsAndTiers,
  sponsorCancelled: () => sponsorCancelled,
  sponsorCreated: () => sponsorCreated,
  sponsorEdited: () => sponsorEdited
});
async function sponsorCreated({ login, newTier }) {
  await inviteAllSponsors();
}
async function sponsorEdited({ login, oldTier, newTier }) {
  oldTier = await getTierById(oldTier.id);
  await octokit.teams.removeMembershipForUserInOrg({
    org: GITHUB_ORG,
    team_slug: oldTier.meta.githubTeamSlug,
    username: login
  });
  console.info(`removed user:${login} from team:${oldTier.meta.githubTeamSlug}`);
  await inviteAllSponsors();
}
async function sponsorCancelled({ login, oldTier }) {
  oldTier = await getTierById(oldTier.id);
  await octokit.teams.removeMembershipForUserInOrg({
    org: GITHUB_ORG,
    team_slug: oldTier.meta.githubTeamSlug,
    username: login
  });
  console.info(`removed user:${login} from team:${oldTier.meta.githubTeamSlug}`);
}
async function inviteAllSponsors() {
  let { sponsors } = await getSponsorsAndTiers();
  await Promise.all(sponsors.map(async (sponsor) => {
    await octokit.teams.addOrUpdateMembershipForUserInOrg({
      org: GITHUB_ORG,
      team_slug: sponsor.tier.meta.githubTeamSlug,
      username: sponsor.login
    });
    console.log(`invited user:${sponsor.login} to team:${sponsor.tier.meta.githubTeamSlug}`);
  }));
}
async function getSponsorsAndTiers() {
  const tiers = await getGithubTiersWithMeta();
  await updateTiersMeta(tiers);
  let [sponsors, sponsorsMeta] = await Promise.all([
    getGithubSponsors(),
    getSponsorsMeta().then((all) => all.map((d) => d.fields))
  ]);
  sponsors = sponsors.map((d) => __spreadProps(__spreadValues({}, d), {
    tier: tiers.find((tier) => tier.id == d.tier.id)
  }));
  sponsorsMeta.forEach((sponsorMeta) => {
    const matchingSponsor = sponsors.find((d) => d.login == sponsorMeta.login);
    if (matchingSponsor) {
      Object.assign(matchingSponsor, {
        name: sponsorMeta.name ?? matchingSponsor.name,
        email: sponsorMeta.email ?? matchingSponsor.email,
        imageUrl: sponsorMeta.imageUrl ?? matchingSponsor.imageUrl,
        linkUrl: sponsorMeta.linkUrl ?? matchingSponsor.linkUrl,
        privacyLevel: sponsorMeta.privacyLevel ?? matchingSponsor.privacyLevel
      });
    } else {
      const tier = tiers.find((d) => {
        var _a;
        return d.id === ((_a = sponsorMeta.tierId) == null ? void 0 : _a[0]);
      });
      sponsors.push(__spreadProps(__spreadValues({}, sponsorMeta), {
        tier
      }));
    }
  });
  sponsors.sort((a, b) => b.monthlyPriceInDollars - a.monthlyPriceInDollars || (b.createdAt > a.createdAt ? -1 : 1));
  return {
    sponsors,
    tiers
  };
}
async function getGithubSponsors() {
  let sponsors = [];
  const fetchPage = async (cursor = "") => {
    const res = await graphqlWithAuth(`
      query ($cursor: String) {
        viewer {
          sponsorshipsAsMaintainer(first: 100, after: $cursor, includePrivate: true) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                createdAt
                sponsorEntity {
                  ... on User {
                    name
                    login
                    email
                  }
                  ... on Organization {
                    name
                    login
                    email
                  }
                }
                tier {
                  id
                  monthlyPriceInDollars
                }
                privacyLevel
              }
            }
          }
        }
      }
      `, {
      cursor
    });
    const {
      viewer: {
        sponsorshipsAsMaintainer: {
          pageInfo: { hasNextPage, endCursor },
          edges
        }
      }
    } = res;
    sponsors = [
      ...sponsors,
      ...edges.map((edge) => {
        const {
          node: { createdAt, sponsorEntity, tier, privacyLevel }
        } = edge;
        if (!sponsorEntity) {
          return null;
        }
        const { name, login, email } = sponsorEntity;
        return {
          name,
          login,
          email,
          tier,
          createdAt,
          privacyLevel
        };
      })
    ];
    if (hasNextPage) {
      await fetchPage(endCursor);
    }
  };
  await fetchPage();
  return sponsors.filter(Boolean);
}
async function getSponsorsMeta() {
  const sponsorsTable = await getSponsorsTable();
  return new Promise((resolve, reject) => {
    let allSponsors = [];
    sponsorsTable.select().eachPage(function page(records, fetchNextPage) {
      allSponsors = [...allSponsors, ...records];
      fetchNextPage();
    }, function done(err) {
      if (err) {
        reject(err);
      } else {
        resolve(allSponsors);
      }
    });
  });
}
var init_sponsors = __esm({
  "app/server/sponsors.ts"() {
    init_react();
    init_airtable();
    init_github();
    init_tiers();
  }
});

// app/images/logo-white.svg
var require_logo_white = __commonJS({
  "app/images/logo-white.svg"(exports, module2) {
    module2.exports = "/build/_assets/logo-white-RTGAUJJ2.svg";
  }
});

// app/images/header-left-overlay.svg
var require_header_left_overlay = __commonJS({
  "app/images/header-left-overlay.svg"(exports, module2) {
    module2.exports = "/build/_assets/header-left-overlay-QXEDATEO.svg";
  }
});

// app/images/javascript-logo-white.svg
var require_javascript_logo_white = __commonJS({
  "app/images/javascript-logo-white.svg"(exports, module2) {
    module2.exports = "/build/_assets/javascript-logo-white-LLURRCID.svg";
  }
});

// app/images/react-logo-white.svg
var require_react_logo_white = __commonJS({
  "app/images/react-logo-white.svg"(exports, module2) {
    module2.exports = "/build/_assets/react-logo-white-TDWGCHBC.svg";
  }
});

// app/images/discord-logo-white.svg
var require_discord_logo_white = __commonJS({
  "app/images/discord-logo-white.svg"(exports, module2) {
    module2.exports = "/build/_assets/discord-logo-white-U3OQBSJY.svg";
  }
});

// <stdin>
__export(exports, {
  assets: () => import_assets.default,
  entry: () => entry,
  routes: () => routes
});
init_react();

// app/entry.server.tsx
var entry_server_exports = {};
__export(entry_server_exports, {
  default: () => handleRequest
});
init_react();
var import_server = __toModule(require("react-dom/server"));
var import_remix = __toModule(require("remix"));
var import_sheets = __toModule(require("twind/sheets"));
var import_twind = __toModule(require("twind"));

// twind.shared.ts
init_react();
var sharedTwindConfig = {
  theme: {
    extend: {
      zIndex: {
        "-10": "-10"
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
        DEFAULT: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)",
        md: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
        lg: "0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.03)",
        xl: "0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02)",
        "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.2)",
        "3xl": "0 35px 60px -15px rgba(0, 0, 0, 0.25)",
        inner: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.04)",
        none: "none"
      },
      colors: {
        red: {
          default: "#FF4255",
          100: "#FFE5E8",
          200: "#FFBDC3",
          300: "#FF949F",
          400: "#FF6B7A",
          500: "#FF4255",
          600: "#FF001A",
          700: "#BD0013",
          800: "#7A000C",
          900: "#380006"
        },
        blue: {
          default: "#0068B3",
          100: "#D1ECFF",
          200: "#8ACEFF",
          300: "#42B0FF",
          400: "#0092FA",
          500: "#0068B3",
          600: "#00508A",
          700: "#003961",
          800: "#002138",
          900: "#00090F"
        },
        yellow: {
          default: "#FFD84D",
          100: "#FFFCF0",
          200: "#FFF3C7",
          300: "#FFEA9E",
          400: "#FFE175",
          500: "#FFD84D",
          600: "#FFC800",
          700: "#B38C00",
          800: "#665000",
          900: "#1A1400"
        },
        orange: {
          default: "#FF9238",
          100: "#FFF7F0",
          200: "#FFDDC2",
          300: "#FFC494",
          400: "#FFAB66",
          500: "#FF9238",
          600: "#F56E00",
          700: "#B35000",
          800: "#703200",
          900: "#2E1500"
        },
        discord: "#536bbd"
      }
    }
  }
};

// app/entry.server.tsx
if (!global.__sheet) {
  global.__sheet = (0, import_sheets.virtualSheet)();
  (0, import_twind.setup)(__spreadProps(__spreadValues({}, sharedTwindConfig), {
    sheet: global.__sheet
  }));
}
function handleRequest(request, responseStatusCode, responseHeaders, remixContext) {
  global.__sheet.reset();
  let markup = (0, import_server.renderToString)(/* @__PURE__ */ React.createElement(import_remix.RemixServer, {
    context: remixContext,
    url: request.url
  }));
  const styleTag = (0, import_sheets.getStyleTag)(global.__sheet);
  markup = markup.replace("</head>", styleTag + "</head>");
  responseHeaders.set("Content-Type", "text/html");
  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: responseHeaders
  });
}

// route-module:/Users/tannerlinsley/GitHub/tanstack.com/app/root.tsx
var root_exports = {};
__export(root_exports, {
  CatchBoundary: () => CatchBoundary,
  ErrorBoundary: () => ErrorBoundary,
  default: () => App,
  links: () => links
});
init_react();
var React2 = __toModule(require("react"));
var import_twind4 = __toModule(require("twind"));
var import_remix2 = __toModule(require("remix"));

// app/styles/global.tsx
init_react();
var import_twind3 = __toModule(require("twind"));
var import_css = __toModule(require("twind/css"));
var getGlobalStyles = () => import_css.css`
  html,
  body {
    ${import_css.apply`text-blue-900 bg-gray-100 dark:bg-gray-900 dark:text-gray-100`}
  }

  @media (prefers-color-scheme: dark) {
    * {
      scrollbar-color: ${(0, import_twind3.theme)("colors.gray.700")} ${(0, import_twind3.theme)("colors.gray.800")};

      ::-webkit-scrollbar,
      scrollbar {
        width: 1rem;
        height: 1rem;
      }

      ::-webkit-scrollbar-track,
      scrollbar-track {
        background: ${(0, import_twind3.theme)("colors.gray.800")};
      }

      ::-webkit-scrollbar-thumb,
      scrollbar-thumb {
        background: ${(0, import_twind3.theme)("colors.gray.700")};
        border-radius: 0.5rem;
        border: 3px solid ${(0, import_twind3.theme)("colors.gray.800")};
      }
    }
  }

  [disabled] {
    ${import_css.apply`opacity-50 pointer-events-none`}
  }
`;

// route-module:/Users/tannerlinsley/GitHub/tanstack.com/app/root.tsx
var links = () => {
  return [
    {
      rel: "stylesheet",
      href: require_carbonads()
    }
  ];
};
function App() {
  return /* @__PURE__ */ React2.createElement(Document, null, /* @__PURE__ */ React2.createElement(import_remix2.Outlet, null));
}
function Document({
  children,
  title
}) {
  const matches = (0, import_remix2.useMatches)();
  return /* @__PURE__ */ React2.createElement("html", {
    lang: "en",
    className: (0, import_twind4.tw)(getGlobalStyles())
  }, /* @__PURE__ */ React2.createElement("head", null, /* @__PURE__ */ React2.createElement("meta", {
    charSet: "utf-8"
  }), /* @__PURE__ */ React2.createElement("meta", {
    name: "viewport",
    content: "width=device-width,initial-scale=1"
  }), matches.find((d) => {
    var _a;
    return (_a = d.handle) == null ? void 0 : _a.baseParent;
  }) ? /* @__PURE__ */ React2.createElement("base", {
    target: "_parent"
  }) : null, title ? /* @__PURE__ */ React2.createElement("title", null, title) : null, /* @__PURE__ */ React2.createElement(import_remix2.Meta, null), /* @__PURE__ */ React2.createElement(import_remix2.Links, null)), /* @__PURE__ */ React2.createElement("body", null, children, /* @__PURE__ */ React2.createElement(import_remix2.ScrollRestoration, null), /* @__PURE__ */ React2.createElement(import_remix2.Scripts, null), /* @__PURE__ */ React2.createElement("script", {
    src: "https://js.hs-scripts.com/8180418.js",
    id: "hs-script-loader"
  }), process.env.NODE_ENV === "development" && /* @__PURE__ */ React2.createElement(import_remix2.LiveReload, null)));
}
function CatchBoundary() {
  let caught = (0, import_remix2.useCatch)();
  let message;
  switch (caught.status) {
    case 401:
      message = /* @__PURE__ */ React2.createElement("p", null, "Oops! Looks like you tried to visit a page that you do not have access to.");
      break;
    case 404:
      message = /* @__PURE__ */ React2.createElement("p", null, "Oops! Looks like you tried to visit a page that does not exist.");
      break;
    default:
      throw new Error(caught.data || caught.statusText);
  }
  return /* @__PURE__ */ React2.createElement(Document, {
    title: `${caught.status} ${caught.statusText}`
  }, /* @__PURE__ */ React2.createElement("h1", null, caught.status, ": ", caught.statusText), message);
}
function ErrorBoundary({ error }) {
  console.error(error);
  return /* @__PURE__ */ React2.createElement(Document, {
    title: "Error!"
  }, /* @__PURE__ */ React2.createElement("div", null, /* @__PURE__ */ React2.createElement("h1", null, "There was an error!"), /* @__PURE__ */ React2.createElement("p", null, error.message)));
}

// route-module:/Users/tannerlinsley/GitHub/tanstack.com/app/routes/api/github-sponsors-webhook.ts
var github_sponsors_webhook_exports = {};
__export(github_sponsors_webhook_exports, {
  action: () => action
});
init_react();
var import_crypto = __toModule(require("crypto"));
init_sponsors();
async function verifySecret(req) {
  const sig = req.headers.get("x-hub-signature") || "";
  const hmac = import_crypto.default.createHmac("sha1", process.env.GITHUB_SPONSORS_WEBHOOK_SECRET);
  const digest = Buffer.from("sha1=" + hmac.update(JSON.stringify(req.body)).digest("hex"), "utf8");
  const checksum = Buffer.from(sig, "utf8");
  if (checksum.length !== digest.length || !import_crypto.default.timingSafeEqual(digest, checksum)) {
    throw new Error(`Request body digest (${digest}) did not match x-hub-signature (${checksum})`);
  }
}
var action = async (ctx) => {
  await verifySecret(ctx.request);
  const githubEvent = ctx.request.headers.get("x-github-event");
  const id = ctx.request.headers.get("x-github-delivery");
  if (!githubEvent) {
    throw new Response("No X-Github-Event found on request", {
      status: 400
    });
  }
  if (!id) {
    throw new Response("No X-Github-Delivery found on request", {
      status: 400
    });
  }
  const event = await ctx.request.json();
  if (!(event == null ? void 0 : event.action)) {
    throw new Error("No event body action found on request");
  }
  if (event.action == "created") {
    sponsorCreated({
      login: event.sponsorship.sponsor.login,
      newTier: event.sponsorship.tier
    });
    return new Response("Created", { status: 200 });
  }
  if (event.action == "cancelled") {
    sponsorCancelled({
      login: event.sponsorship.sponsor.login,
      oldTier: event.sponsorship.tier
    });
    return new Response("Cancelled", { status: 200 });
  }
  if (event.action == "tier_changed") {
    sponsorEdited({
      login: event.sponsorship.sponsor.login,
      oldTier: event.changes.tier,
      newTier: event.sponsorship.tier
    });
    return new Response("Updated", { status: 200 });
  }
  return new Response("OK", { status: 200 });
};

// route-module:/Users/tannerlinsley/GitHub/tanstack.com/app/routes/api/link-discord-github.ts
var link_discord_github_exports = {};
__export(link_discord_github_exports, {
  action: () => action2
});
init_react();

// app/server/discord-github.ts
init_react();
var import_rest2 = __toModule(require("@octokit/rest"));

// app/server/discord.ts
init_react();
var import_axios2 = __toModule(require("axios"));
var qss = __toModule(require("qss"));
var discordClientId = "725855554362146899";
var discordClientSecret = process.env.DISCORD_APP_CLIENT_SECRET;
var guildId = "719702312431386674";
var discordBaseURL = "https://discord.com/api/";
var rolesBySponsorType = {
  fan: "Fan",
  supporter: "Supporter",
  premierSponsor: "Premier Sponsor"
};
var TanBotToken = process.env.DISCORD_TOKEN;
async function linkSponsorToken({ discordToken, sponsorType }) {
  if (sponsorType === "sleep-aid") {
    throw new Error('\u{1F614} You must be at least a "Fan" sponsor to access exclusive discord channels.');
  }
  if (!rolesBySponsorType[sponsorType]) {
    throw new Error("Invalid sponsor type! Contact support, please!");
  }
  const botClient = import_axios2.default.create({
    baseURL: discordBaseURL,
    headers: {
      authorization: `Bot ${TanBotToken}`
    }
  });
  const userClient = import_axios2.default.create({
    baseURL: discordBaseURL,
    headers: {
      authorization: `Bearer ${discordToken}`
    }
  });
  let roles, userData;
  try {
    const { data } = await botClient.get(`/guilds/${guildId}/roles`);
    roles = data;
  } catch (err) {
    console.error(err);
    throw new Error("Unable to fetch Discord roles. Please contact support!");
  }
  try {
    const { data } = await userClient.get("/users/@me");
    userData = data;
  } catch (err) {
    console.error(err);
    throw new Error("Unable to fetch Discord user info. Please contact support!");
  }
  let tierRole = roles.find((role) => role.name.includes(rolesBySponsorType[sponsorType]));
  if (!tierRole) {
    throw new Error("Could not find Discord role for sponsor tier! Please contact support.");
  }
  let addData;
  try {
    const { data } = await botClient.put(`/guilds/${guildId}/members/${userData.id}`, {
      roles: [tierRole.id],
      access_token: discordToken
    });
    addData = data;
  } catch (err) {
    throw new Error("Unable to add user to TanStack Discord. Please contact support.");
  }
  if (!addData) {
    try {
      await botClient.patch(`/guilds/${guildId}/members/${userData.id}`, {
        roles: [tierRole.id],
        access_token: discordToken
      });
    } catch (err) {
      throw new Error("Could not update Discord role for user! Please contact support.");
    }
  }
  return `You have been successfully added to the TanStack discord, along with the exclusive access to the sponsors-only "${tierRole.name}" channel!`;
}
async function exchangeDiscordCodeForToken({ code, redirectUrl }) {
  try {
    const body = qss.encode({
      client_id: discordClientId,
      client_secret: discordClientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUrl,
      scope: "identify guilds.join"
    });
    const { data } = await import_axios2.default.post("https://discord.com/api/oauth2/token", body, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });
    return data.access_token;
  } catch (err) {
    console.error(err);
    throw new Error("Unable to authenticate with Discord. Please log in again.");
  }
}

// app/server/discord-github.ts
init_sponsors();
async function linkGithubAndDiscordUser({ githubToken, discordToken }) {
  let login;
  try {
    const octokit2 = new import_rest2.Octokit({
      auth: githubToken,
      useAgent: `TanStack.com ${githubToken}`
    });
    const { data } = await octokit2.users.getAuthenticated();
    login = data.login;
  } catch (err) {
    console.error(err);
    throw new Error("Unable to fetch Github user info. Please log in again.");
  }
  let sponsor;
  try {
    const { sponsors } = await getSponsorsAndTiers();
    sponsor = sponsors.find((d) => d.login == login);
  } catch (err) {
    throw new Error("Unable to fetch sponsor info. Please contact support.");
  }
  if (!sponsor) {
    throw new Error(`TanStack sponsorship not found for Github user "${login}". Please sign up at https://github.com/sponsors/tannerlinsley`);
  }
  const sponsorType = sponsor.tier.meta.sponsorType;
  const message = await linkSponsorToken({
    discordToken,
    sponsorType
  });
  return message;
}

// route-module:/Users/tannerlinsley/GitHub/tanstack.com/app/routes/api/link-discord-github.ts
init_github();
var action2 = async (ctx) => {
  const { discordCode, githubCode, githubState, redirectUrl } = await ctx.request.json();
  try {
    let [githubToken, discordToken] = await Promise.all([
      exchangeGithubCodeForToken({
        code: githubCode,
        state: githubState,
        redirectUrl
      }),
      exchangeDiscordCodeForToken({
        code: discordCode,
        redirectUrl
      })
    ]);
    const message = await linkGithubAndDiscordUser({
      githubToken,
      discordToken
    });
    return { message };
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400 });
  }
};

// route-module:/Users/tannerlinsley/GitHub/tanstack.com/app/routes/sponsors-embed.tsx
var sponsors_embed_exports = {};
__export(sponsors_embed_exports, {
  default: () => Sponsors,
  handle: () => handle,
  headers: () => headers,
  loader: () => loader
});
init_react();

// app/components/SponsorPack.tsx
init_react();
var import_react = __toModule(require("react"));
var import_hierarchy = __toModule(require("@visx/hierarchy"));
var import_responsive = __toModule(require("@visx/responsive"));
var import_twind5 = __toModule(require("twind"));
function SponsorPack({ sponsors }) {
  const pack = import_react.default.useMemo(() => ({
    children: sponsors,
    name: "root",
    radius: 0,
    distance: 0
  }), [sponsors]);
  const root = import_react.default.useMemo(() => (0, import_hierarchy.hierarchy)(pack).sum((d) => {
    var _a;
    return 1 + ((_a = d == null ? void 0 : d.tier) == null ? void 0 : _a.monthlyPriceInDollars);
  }).sort((a, b) => {
    var _a, _b;
    return (((_a = b.data.tier) == null ? void 0 : _a.monthlyPriceInDollars) ?? 0) - (((_b = a.data.tier) == null ? void 0 : _b.monthlyPriceInDollars) ?? 0);
  }), [pack]);
  return /* @__PURE__ */ import_react.default.createElement(import_responsive.ParentSize, null, ({ width = 800 }) => {
    return width < 10 ? null : /* @__PURE__ */ import_react.default.createElement("div", {
      style: {
        width,
        height: width,
        position: "relative"
      }
    }, /* @__PURE__ */ import_react.default.createElement("style", {
      dangerouslySetInnerHTML: {
        __html: `

              .spon-link {
                transition: all .2s ease;
                transform: translate(-50%, -50%);
              }

              .spon-link:hover {
                z-index: 10;
                transform: translate(-50%, -50%) scale(1.1);
              }

              .spon-link:hover .spon-tooltip {
                opacity: 1;
              }
            `
      }
    }), /* @__PURE__ */ import_react.default.createElement(import_hierarchy.Pack, {
      root,
      size: [width, width],
      padding: width * 5e-3
    }, (packData) => {
      const circles = packData.descendants().slice(1);
      return /* @__PURE__ */ import_react.default.createElement("div", null, [...circles].reverse().map((circle, i) => {
        var _a, _b;
        const tooltipX = circle.x > width / 2 ? "left" : "right";
        const tooltipY = circle.y > width / 2 ? "top" : "bottom";
        return /* @__PURE__ */ import_react.default.createElement("a", {
          key: `circle-${i}`,
          href: circle.data.linkUrl || `https://github.com/${circle.data.login}`,
          className: `spon-link ` + import_twind5.tw`absolute shadow-lg bg-white rounded-full z-0`,
          style: {
            left: circle.x,
            top: circle.y,
            width: circle.r * 2,
            height: circle.r * 2
          }
        }, /* @__PURE__ */ import_react.default.createElement("div", {
          key: `circle-${i}`,
          className: import_twind5.tw`absolute bg-no-repeat bg-center bg-contain rounded-full`,
          style: {
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "90%",
            height: "90%",
            backgroundImage: `url(${circle.data.imageUrl || `https://avatars0.githubusercontent.com/${circle.data.login}?v=3&s=200`})`
          }
        }), /* @__PURE__ */ import_react.default.createElement("div", {
          className: `spon-tooltip ` + (0, import_twind5.tw)(`absolute
                              text-sm
                              bg-gray-900 text-white p-2 pointer-events-none
                              transform opacity-0
                              shadow-xl rounded-lg
                              flex flex-col items-center
                            `, tooltipX == "left" ? import_twind5.tw`left-1/4 -translate-x-full` : import_twind5.tw`right-1/4 translate-x-full`, tooltipY == "top" ? import_twind5.tw`top-1/4 -translate-y-full` : import_twind5.tw`bottom-1/4 translate-y-full`)
        }, /* @__PURE__ */ import_react.default.createElement("p", {
          className: import_twind5.tw`whitespace-nowrap font-bold`
        }, circle.data.name || circle.data.login), ((_a = circle.data.tier) == null ? void 0 : _a.monthlyPriceInDollars) ? /* @__PURE__ */ import_react.default.createElement("p", {
          className: import_twind5.tw`whitespace-nowrap`
        }, "$", (_b = circle.data.tier) == null ? void 0 : _b.monthlyPriceInDollars, " / month") : null));
      }));
    }));
  });
}

// route-module:/Users/tannerlinsley/GitHub/tanstack.com/app/routes/sponsors-embed.tsx
var import_remix3 = __toModule(require("remix"));
var import_twind6 = __toModule(require("twind"));
var handle = {};
var loader = async () => {
  const { getSponsorsAndTiers: getSponsorsAndTiers2 } = (init_sponsors(), sponsors_exports);
  let { sponsors } = await getSponsorsAndTiers2();
  sponsors = sponsors.filter((d) => d.privacyLevel === "PUBLIC");
  return (0, import_remix3.json)({
    sponsors
  }, {
    headers: {
      "Cache-Control": "max-age=300, s-maxage=3600, stale-while-revalidate"
    }
  });
};
var headers = ({ loaderHeaders }) => {
  return {
    "Cache-Control": loaderHeaders.get("Cache-Control") ?? ""
  };
};
function Sponsors() {
  const { sponsors } = (0, import_remix3.useLoaderData)();
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", {
    className: import_twind6.tw`h-screen w-screen flex items-center justify-center overflow-hidden`
  }, /* @__PURE__ */ React.createElement("style", {
    dangerouslySetInnerHTML: {
      __html: `
        html, body {
          background: transparent;
        }
      `
    }
  }), /* @__PURE__ */ React.createElement(SponsorPack, {
    sponsors
  })));
}

// route-module:/Users/tannerlinsley/GitHub/tanstack.com/app/routes/sponsor-login.tsx
var sponsor_login_exports = {};
__export(sponsor_login_exports, {
  default: () => SponsorsLogin
});
init_react();
var import_react3 = __toModule(require("react"));
var qss2 = __toModule(require("qss"));
var import_fa = __toModule(require("react-icons/fa"));

// app/hooks/useSessionStorage.ts
init_react();
var import_react2 = __toModule(require("react"));
function useSessionStorage(key, defaultValue = "") {
  const [state, setState] = import_react2.default.useState(() => {
    if (typeof document !== "undefined") {
      const data = sessionStorage.getItem(key);
      if (data) {
        try {
          return JSON.parse(data);
        } catch {
        }
      }
      return defaultValue;
    }
    return defaultValue;
  });
  import_react2.default.useEffect(() => {
    sessionStorage.setItem(key, JSON.stringify(state));
  }, [state]);
  return [state, setState];
}

// route-module:/Users/tannerlinsley/GitHub/tanstack.com/app/routes/sponsor-login.tsx
var import_axios3 = __toModule(require("axios"));
var import_twind7 = __toModule(require("twind"));
var discordClientID = "725855554362146899";
var githubClientID2 = "Iv1.3aa8d13a4a3fde91";
var discordOauthStateKey = "discord_oauth_state";
var githubOauthStateKey = "github_oauth_state";
var discordOauthCodeKey = "discord_oauth_token";
var githubOauthCodeKey = "github_oauth_token";
var discordScope = "identify guilds.join";
var githubScope = "user";
var getbuttonStyles = () => import_twind7.tw`
  px-4 py-2
  cursor-pointer
  rounded-lg
  flex items-center gap-2
`;
function SponsorsLogin() {
  const [loadingMessage, setIsLoading] = import_react3.default.useState("Loading...");
  const [error, setError] = import_react3.default.useState(null);
  const [message, setMessage] = import_react3.default.useState(null);
  const [discordState, setDiscordState] = useSessionStorage(discordOauthStateKey);
  const [githubState, setGithubState] = useSessionStorage(githubOauthStateKey);
  const [discordCode, setDiscordCode] = useSessionStorage(discordOauthCodeKey);
  const [githubCode, setGithubCode] = useSessionStorage(githubOauthCodeKey);
  const loginToDiscord = async () => {
    setError(null);
    const state = generateState();
    setDiscordState(state);
    window.location = `https://discord.com/oauth2/authorize?response_type=code&client_id=${discordClientID}&state=${state}&scope=${discordScope}&redirect_uri=${getRedirectUrl()}`;
  };
  const loginToGithub = async () => {
    setError(null);
    const state = generateState();
    setGithubState(state);
    window.location = `https://github.com/login/oauth/authorize?response_type=code&client_id=${githubClientID2}&state=${state}&scope=${githubScope}&redirect_uri=${getRedirectUrl()}`;
  };
  const linkAccounts = async () => {
    setIsLoading("Linking accounts...");
    try {
      const {
        data: { message: message2, error: error2 }
      } = await import_axios3.default.post("/api/link-discord-github", {
        discordCode,
        discordState,
        githubCode,
        githubState,
        redirectUrl: getRedirectUrl()
      });
      if (error2) {
        setError(error2);
      } else {
        setMessage(message2);
      }
    } catch (err) {
      setError(err);
    } finally {
      setDiscordCode(null);
      setGithubCode(null);
      setIsLoading(false);
    }
  };
  import_react3.default.useEffect(() => {
    setIsLoading(false);
    const search = window.location.search.substring(1);
    if (search) {
      let { code, state } = qss2.decode(search);
      state = state + "";
      if (state === githubState) {
        setGithubCode(code);
      } else if (state === discordState) {
        setDiscordCode(code);
      }
      window.location = getRedirectUrl();
    }
  }, []);
  return /* @__PURE__ */ import_react3.default.createElement("div", null, error ? /* @__PURE__ */ import_react3.default.createElement("div", {
    className: import_twind7.tw`p-2 text-center bg-red-500 text-white`
  }, /* @__PURE__ */ import_react3.default.createElement("p", null, error)) : message ? /* @__PURE__ */ import_react3.default.createElement("div", {
    className: import_twind7.tw`p-2 text-center bg-blue-500 text-white`
  }, /* @__PURE__ */ import_react3.default.createElement("p", null, message)) : null, /* @__PURE__ */ import_react3.default.createElement("div", {
    className: import_twind7.tw`h-4`
  }), /* @__PURE__ */ import_react3.default.createElement("div", {
    className: import_twind7.tw`p-2`
  }, /* @__PURE__ */ import_react3.default.createElement("h1", {
    className: import_twind7.tw`text-center text-2xl`
  }, "Sponsor Log-in"), /* @__PURE__ */ import_react3.default.createElement("div", {
    className: import_twind7.tw`h-6`
  }), /* @__PURE__ */ import_react3.default.createElement("div", null, loadingMessage ? /* @__PURE__ */ import_react3.default.createElement("div", {
    className: import_twind7.tw`text-center`
  }, loadingMessage) : /* @__PURE__ */ import_react3.default.createElement("div", {
    className: import_twind7.tw`flex flex-col gap-2 flex-wrap items-center`
  }, /* @__PURE__ */ import_react3.default.createElement("div", {
    className: import_twind7.tw`flex items-center justify-center gap-2`
  }, /* @__PURE__ */ import_react3.default.createElement("button", {
    className: [
      getbuttonStyles(),
      import_twind7.tw`bg-gray-900 text-white`,
      githubCode && import_twind7.tw`opacity-50`
    ].join(" "),
    onClick: loginToGithub
  }, githubCode ? /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, /* @__PURE__ */ import_react3.default.createElement(import_fa.FaCheck, null), " Github") : /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, /* @__PURE__ */ import_react3.default.createElement(import_fa.FaGithub, null), "Log In to Github")), /* @__PURE__ */ import_react3.default.createElement("button", {
    className: [
      getbuttonStyles(),
      import_twind7.tw`bg-purple-500 text-white`,
      discordCode && import_twind7.tw`opacity-50`
    ].join(" "),
    onClick: loginToDiscord
  }, discordCode ? /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, /* @__PURE__ */ import_react3.default.createElement(import_fa.FaCheck, null), " Discord") : /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, /* @__PURE__ */ import_react3.default.createElement(import_fa.FaDiscord, null), " Log In to Discord"))), githubCode && discordCode ? /* @__PURE__ */ import_react3.default.createElement("div", {
    className: import_twind7.tw`text-center`
  }, /* @__PURE__ */ import_react3.default.createElement("button", {
    className: [
      getbuttonStyles(),
      import_twind7.tw`bg-blue-500 text-white`
    ].join(" "),
    onClick: () => linkAccounts(),
    disabled: loadingMessage
  }, /* @__PURE__ */ import_react3.default.createElement(import_fa.FaPlug, null), " Link Accounts")) : null)), /* @__PURE__ */ import_react3.default.createElement("div", {
    className: import_twind7.tw`h-6`
  }), /* @__PURE__ */ import_react3.default.createElement("div", {
    className: import_twind7.tw`text-center`
  }, /* @__PURE__ */ import_react3.default.createElement("p", null, "Not a sponsor yet?", " ", /* @__PURE__ */ import_react3.default.createElement("a", {
    href: "https://github.com/sponsors/tannerlinsley",
    className: import_twind7.tw`underline text-green-600 font-bold`
  }, "Sign up here!")))));
}
function generateState() {
  return `st_${(Math.random() + "").replace(".", "")}`;
}
function getRedirectUrl() {
  return window.location.origin + window.location.pathname;
}

// route-module:/Users/tannerlinsley/GitHub/tanstack.com/app/routes/index.tsx
var routes_exports = {};
__export(routes_exports, {
  default: () => Index,
  meta: () => meta
});
init_react();
var import_css2 = __toModule(require("twind/css"));
var import_remix5 = __toModule(require("remix"));

// app/components/Nav.tsx
init_react();
var import_remix4 = __toModule(require("remix"));
var import_twind8 = __toModule(require("twind"));
var links2 = [
  { href: "https://github.com/tannerlinsley", label: "GitHub" },
  { href: "https://discord.com/invite/WrRKjPJ", label: "Discord" }
];
function Nav() {
  return /* @__PURE__ */ React.createElement("nav", {
    className: import_twind8.tw`max-w-screen-md mx-auto text-white`
  }, /* @__PURE__ */ React.createElement("ul", {
    className: import_twind8.tw`flex items-center justify-between p-8`
  }, /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix4.Link, {
    to: "/"
  }, /* @__PURE__ */ React.createElement("img", {
    src: require_logo_white(),
    alt: "TanStack Logo",
    width: 100,
    height: 20
  }))), /* @__PURE__ */ React.createElement("ul", {
    className: import_twind8.tw`flex items-center justify-between space-x-2`
  }, links2.map(({ href, label }) => /* @__PURE__ */ React.createElement("li", {
    key: `${href}${label}`
  }, /* @__PURE__ */ React.createElement(import_remix4.Link, {
    to: href,
    className: import_twind8.tw`inline px-2 py-1 rounded-md transition-all hover:(bg-gray-900 bg-opacity-20)`
  }, label))))));
}

// app/components/CarbonAds.tsx
init_react();
var React6 = __toModule(require("react"));
function CarbonAds() {
  const ref = React6.useRef(null);
  React6.useEffect(() => {
    ref.current.innerHTML = "";
    const s = document.createElement("script");
    s.id = "_carbonads_js";
    s.src = `//cdn.carbonads.com/carbon.js?serve=CE7DEKQI&placement=react-tannerlinsleycom`;
    ref.current.appendChild(s);
  }, []);
  return /* @__PURE__ */ React6.createElement("div", {
    ref
  });
}

// route-module:/Users/tannerlinsley/GitHub/tanstack.com/app/routes/index.tsx
var import_responsive2 = __toModule(require("@visx/responsive"));
var libraries = [
  {
    name: "React Query",
    getStyles: () => import_css2.tw`bg-red-500 hover:(bg-white border-red-500 bg-transparent text-red-500 dark:text-red-400)`,
    href: "https://react-query.tanstack.com",
    tagline: `Performant and powerful data synchronization for React`,
    description: `Fetch, cache and update data in your React and React Native applications all without touching any "global state".`
  },
  {
    name: "React Table",
    getStyles: () => import_css2.tw`bg-blue-500 hover:(bg-white border-blue-500 bg-transparent text-blue-600 dark:text-blue-400)`,
    href: "https://react-table.tanstack.com",
    tagline: `Lightweight and extensible data tables for React`,
    description: `Build and design powerful datagrid experiences while retaining 100% control over markup and styles.`
  },
  {
    name: "React Charts",
    getStyles: () => import_css2.tw`bg-yellow-500 text-black hover:(bg-white border-yellow-500 bg-transparent dark:text-yellow-500)`,
    href: "https://react-charts.tanstack.com",
    tagline: `Simple, immersive & interactive charts for React`,
    description: `Flexible, declarative, and highly configurable charts designed to pragmatically display dynamic data.`
  },
  {
    name: "React Location",
    getStyles: () => import_css2.tw`bg-green-500 hover:(bg-white border-green-700 bg-transparent text-green-700 dark:text-green-400)`,
    href: "https://react-location.tanstack.com",
    tagline: `Enterprise routing for React applications`,
    description: `Powerful, enterprise-grade routing including first-class URL Search APIs, declarative/suspendable route loaders & code-splitting and more.`
  },
  {
    name: "React Virtual",
    getStyles: () => import_css2.tw`bg-purple-600 hover:(bg-white border-purple-700 bg-transparent text-purple-700 dark:text-purple-400)`,
    href: "https://react-virtual.tanstack.com",
    tagline: `Auto-sizing, buttery smooth headless virtualization... with just one hook.`,
    description: `Oh, did we mention it supports vertical, horizontal, grid, fixed, variable, dynamic, smooth and infinite virtualization too?`
  }
];
var courses = [
  {
    name: "React Query Essentials (v2)",
    getStyles: () => import_css2.tw`border-t-4 border-red-500 hover:(border-green-500)`,
    href: "https://learn.tanstack.com",
    description: `The official and exclusive guide to mastering server-state in your applications, straight from the original creator and maintainer of the library.`,
    price: `$30 - $100`
  }
];
var footerLinks = [
  { name: "Twitter", href: "https://twitter.com/tannerlinsley" },
  {
    name: "Youtube",
    href: "https://www.youtube.com/user/tannerlinsley"
  },
  { name: "Github", href: "https://github.com/tannerlinsley" },
  {
    name: "Nozzle.io - Keyword Rank Tracker",
    href: "https://nozzle.io"
  },
  {
    name: `Tanner's Blog`,
    href: "https://tannerlinsley.com"
  }
];
var meta = () => {
  const title = "Quality Software & Open Source Libraries for the Modern Web";
  const description = `TanStack is an incubator and collection of software, products, tools and courses for building professional and enterprise-grade front-end applciations for the web.`;
  const imageHref = "https://remix-jokes.lol/img/og.png";
  return {
    title,
    description,
    keywords: "tanstack,react,reactjs,react query,react table,open source,open source software,oss,software",
    "twitter:image": imageHref,
    "twitter:card": "summary_large_image",
    "twitter:creator": "@remix_run",
    "twitter:site": "@remix_run",
    "twitter:title": "Remix Jokes",
    "twitter:description": description,
    "og:type": "website",
    "og:title": title,
    "og:description": description,
    "og:image": imageHref
  };
};
function Index() {
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("section", {
    className: import_css2.tw`text-white relative bg-red-500`,
    style: {
      backgroundImage: `
          radial-gradient(circle at 25% 140vw, transparent 85%, ${import_css2.tw.theme("colors.yellow.500")}),
          radial-gradient(circle at 75% -100vw, transparent 85%, ${import_css2.tw.theme("colors.blue.500")})
          `
    }
  }, /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`absolute bg-cover bg-center inset-0`,
    style: {
      backgroundImage: `url(${require_header_left_overlay()})`
    }
  }), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`relative`
  }, /* @__PURE__ */ React.createElement(Nav, null), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`text-center -mt-20 p-20`
  }, /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`w-max mx-auto grid gap-2 grid-cols-2`
  }, /* @__PURE__ */ React.createElement("img", {
    src: require_javascript_logo_white(),
    alt: "Javascript Logo",
    width: 70,
    height: 70
  }), /* @__PURE__ */ React.createElement("img", {
    src: require_react_logo_white(),
    alt: "React Logo",
    width: 70,
    height: 70
  })), /* @__PURE__ */ React.createElement("p", {
    className: import_css2.tw`text-4xl text-center italic font-semibold mt-6`
  }, "Quality Software & Libraries"), /* @__PURE__ */ React.createElement("p", {
    className: import_css2.tw`text-2xl text-center font-extralight`
  }, "for the Modern Web")))), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`relative max-w-screen-md mx-2 rounded-md p-8 -mt-10 bg-white shadow-lg md:(p-14 mx-auto) dark:(bg-gray-800)`
  }, /* @__PURE__ */ React.createElement("form", {
    action: "https://app.convertkit.com/forms/1913546/subscriptions",
    method: "post",
    "data-sv-form": "1913546",
    "data-uid": "7b33d93773",
    "data-format": "inline",
    "data-version": "5",
    "data-options": '{"settings":{"after_subscribe":{"action":"message","success_message":"Success! Please, check your email to confirm your subscription.","redirect_url":""},"modal":{"trigger":null,"scroll_percentage":null,"timer":null,"devices":null,"show_once_every":null},"recaptcha":{"enabled":false},"slide_in":{"display_in":null,"trigger":null,"scroll_percentage":null,"timer":null,"devices":null,"show_once_every":null}}}'
  }, /* @__PURE__ */ React.createElement("ul", {
    className: `formkit-alert formkit-alert-error ` + import_css2.tw`hidden`,
    "data-element": "errors",
    "data-group": "alert"
  }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", {
    className: import_css2.tw`text-3xl`
  }, "Don't miss a beat!"), /* @__PURE__ */ React.createElement("h3", {
    className: import_css2.tw`text-lg mt-1`
  }, "Subscribe to our newsletter.")), /* @__PURE__ */ React.createElement("div", {
    "data-element": "fields",
    className: import_css2.tw`grid grid-cols-3 mt-4 gap-2`
  }, /* @__PURE__ */ React.createElement("input", {
    className: "formkit-input " + import_css2.tw`col-span-2 p-3 placeholder-gray-400 text-black bg-gray-200 rounded text-sm outline-none focus:outline-none w-full dark:(text-white bg-gray-700)`,
    name: "email_address",
    placeholder: "Your email address",
    type: "text",
    required: true
  }), /* @__PURE__ */ React.createElement("button", {
    "data-element": "submit",
    className: "formkit-submit " + import_css2.tw`bg-blue-500 rounded text-white`
  }, /* @__PURE__ */ React.createElement("span", null, "Subscribe"))), /* @__PURE__ */ React.createElement("p", {
    className: import_css2.tw`text-sm opacity-30 font-semibold italic mt-2`
  }, "We never spam, promise!"))), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`mt-12 max-w-screen-md mx-4 md:(mx-auto)`
  }, /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`grid grid-cols-1 gap-4 sm:(grid-cols-2)`
  }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", {
    className: import_css2.tw`text-4xl font-light`
  }, "Products"), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`mt-4 bg-white shadow-lg rounded-lg p-4 opacity-70 italic text-center text-gray-600 md:(p-10) dark:(bg-gray-800)`
  }, "Coming soon!")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", {
    className: import_css2.tw`text-4xl font-light`
  }, "Partners"), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`mt-4`
  }, /* @__PURE__ */ React.createElement(CarbonAds, null))))), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`mt-12 max-w-screen-md mx-4 md:(mx-auto)`
  }, /* @__PURE__ */ React.createElement("h3", {
    className: import_css2.tw`text-4xl font-light`
  }, "Open Source Libraries"), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`mt-4 grid grid-cols-1 gap-4 sm:(grid-cols-2)`
  }, libraries.map((library) => /* @__PURE__ */ React.createElement(import_remix5.Link, {
    key: library.name,
    to: library.href,
    className: (0, import_css2.tw)(`border-4 border-transparent rounded-lg shadow-lg p-4 md:(p-10) text-white transition-all`, library.getStyles())
  }, /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`text-3xl font-bold `
  }, library.name), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`text-lg italic font-extralight mt-2`
  }, library.tagline), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`text-sm mt-2`
  }, library.description))))), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`mt-12 max-w-screen-md mx-4
            md:(mx-auto)`
  }, /* @__PURE__ */ React.createElement("h3", {
    className: import_css2.tw`text-4xl font-light`
  }, "Courses"), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`mt-4 grid grid-cols-1 gap-4`
  }, courses.map((course) => /* @__PURE__ */ React.createElement(import_remix5.Link, {
    key: course.name,
    to: course.href,
    className: (0, import_css2.tw)(`bg-white rounded-lg shadow-lg p-4 grid grid-cols-3 gap-6 transition-all ease-linear
                    md:(p-8 grid-cols-6)
                    dark:(bg-gray-800)`, course.getStyles())
  }, /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`col-span-2
                    md:(col-span-5)`
  }, /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`text-2xl font-bold `
  }, course.name), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`text-sm mt-2`
  }, course.description), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`inline-block mt-4 px-4 py-2 bg-green-500 text-white rounded shadow`
  }, "Enroll \u2192")), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`flex-col text-center
                      md:(text-right)`
  }, /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`text-center text-3xl font-bold`
  }, course.price), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`text-center text-sm opacity-70`
  }, "per license")))))), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`mt-12 max-w-screen-md mx-4
            md:(mx-auto)`
  }, /* @__PURE__ */ React.createElement("h3", {
    className: import_css2.tw`text-4xl font-light`
  }, "OSS Sponsors"), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`mt-4 overflow-hidden`
  }, /* @__PURE__ */ React.createElement(import_responsive2.ParentSize, null, ({ width }) => {
    return /* @__PURE__ */ React.createElement("iframe", {
      src: process.env.NODE_ENV === "production" ? "https://tanstack.com/sponsors-embed" : "http://localhost:3001/sponsors-embed",
      loading: "lazy",
      style: {
        width,
        height: width,
        overflow: "hidden"
      }
    });
  })), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`h-6`
  }), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`text-center`
  }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("a", {
    href: "https://github.com/sponsors/tannerlinsley",
    className: import_css2.tw`inline-block p-4 text-lg bg-green-500 rounded text-white`
  }, "Become a Sponsor!")), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`h-4`
  }), /* @__PURE__ */ React.createElement("p", {
    className: import_css2.tw`italic mx-auto max-w-screen-sm text-gray-500`
  }, "Sponsors get special perks like", " ", /* @__PURE__ */ React.createElement("strong", null, "private discord channels, priority issue requests, direct support and even course vouchers"), "!"))), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`
          mt-12 mx-4 max-w-screen-md rounded-md p-4 shadow-lg grid gap-6
          bg-discord text-white overflow-hidden relative
          sm:(p-8 mx-auto grid-cols-3)`
  }, /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`absolute transform opacity-10 z-0
            right-0 top-0 -translate-y-1/3 translate-x-1/3
            sm:(opacity-20)`
  }, /* @__PURE__ */ React.createElement("img", {
    src: require_discord_logo_white(),
    width: 300,
    height: 300
  })), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`sm:(col-span-2)`
  }, /* @__PURE__ */ React.createElement("h3", {
    className: import_css2.tw`text-3xl`
  }, "TanStack on Discord"), /* @__PURE__ */ React.createElement("p", {
    className: import_css2.tw`mt-4`
  }, "The official TanStack community to ask questions, network and make new friends and get lightning fast news about what's coming next for TanStack!")), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`flex items-center justify-center`
  }, /* @__PURE__ */ React.createElement("a", {
    href: "https://discord.com/invite/WrRKjPJ",
    target: "_blank",
    rel: "noreferrer",
    className: import_css2.tw`block w-full mt-4 px-4 py-2 bg-white text-discord text-center text-lg rounded shadow-lg z-10`
  }, "Join TanStack Discord"))), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`h-20`
  }), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`bg-gray-800 text-white shadow-lg`
  }, /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`max-w-screen-md mx-auto py-12 px-4`
  }, /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`grid gap-1 md:(grid-cols-2)`
  }, footerLinks.map((link) => /* @__PURE__ */ React.createElement("div", {
    key: link.href
  }, /* @__PURE__ */ React.createElement(import_remix5.Link, {
    to: link.href,
    className: import_css2.tw`hover:underline`
  }, link.name))))), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`text-center opacity-20 text-sm`
  }, "\xA9 ", new Date().getFullYear(), " Tanner Linsley"), /* @__PURE__ */ React.createElement("div", {
    className: import_css2.tw`h-8`
  })));
}

// <stdin>
var import_assets = __toModule(require("./assets.json"));
var entry = { module: entry_server_exports };
var routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: root_exports
  },
  "routes/api/github-sponsors-webhook": {
    id: "routes/api/github-sponsors-webhook",
    parentId: "root",
    path: "api/github-sponsors-webhook",
    index: void 0,
    caseSensitive: void 0,
    module: github_sponsors_webhook_exports
  },
  "routes/api/link-discord-github": {
    id: "routes/api/link-discord-github",
    parentId: "root",
    path: "api/link-discord-github",
    index: void 0,
    caseSensitive: void 0,
    module: link_discord_github_exports
  },
  "routes/sponsors-embed": {
    id: "routes/sponsors-embed",
    parentId: "root",
    path: "sponsors-embed",
    index: void 0,
    caseSensitive: void 0,
    module: sponsors_embed_exports
  },
  "routes/sponsor-login": {
    id: "routes/sponsor-login",
    parentId: "root",
    path: "sponsor-login",
    index: void 0,
    caseSensitive: void 0,
    module: sponsor_login_exports
  },
  "routes/index": {
    id: "routes/index",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: routes_exports
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  assets,
  entry,
  routes
});
//# sourceMappingURL=/build/index.js.map
