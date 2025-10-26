# Changelog

## 1.0.0 (2025-10-26)


### Features

* **auth:** add /auth/callback route and allow in middleware ([6285ccd](https://github.com/gifayen/englishlearn-app/commit/6285ccdd184f53d1543eef4e753cd58f23da1693))
* **content:** add JHS G7 S1 Unit 01 ([d114a52](https://github.com/gifayen/englishlearn-app/commit/d114a52e9a4a3e8e570cb255549df06da34454cd))
* **content:** add JHS G7 S1 Unit 01 ([dd34b51](https://github.com/gifayen/englishlearn-app/commit/dd34b514547872adb7721fb68cee105bb8ae5c0e))
* **login:** enable Google OAuth and session sync ([d16b184](https://github.com/gifayen/englishlearn-app/commit/d16b184e3fe04ddaebb3f41bcf798cb64c30e97c))
* **reading-links:** add MVP pages and texts API ([fe2133d](https://github.com/gifayen/englishlearn-app/commit/fe2133dffad3de821ae4c0e91cf368cd4b1b221e))
* **reading-links:** normalize Unit JSON (dialogues/reading/exercise/vocab) and tolerant renderer ([52696f6](https://github.com/gifayen/englishlearn-app/commit/52696f67a1486df83dd9e65483ade533474d83b3))
* update unitview and add new unit JSON ([b87949c](https://github.com/gifayen/englishlearn-app/commit/b87949c735f67cf95adf4ee9ce2f1637f603e7b7))
* 新功能或修正說明 ([d28e997](https://github.com/gifayen/englishlearn-app/commit/d28e997982dbe4b5a5254bcf93ab273136cb07e7))
* 登出按扭 ([d4aa2ef](https://github.com/gifayen/englishlearn-app/commit/d4aa2ef1f0b6c09afd30a7fc1ede19f04b731bd7))


### Bug Fixes

* **api:** await params in texts route; add /api/auth/callback; rename nav items ([5f9ebbe](https://github.com/gifayen/englishlearn-app/commit/5f9ebbe6e8999b3da7cdcc33e0d30df8269771a3))
* **auth:** ensure session propagation before redirect; keep UI unchanged ([8697e6d](https://github.com/gifayen/englishlearn-app/commit/8697e6d68a93a8668e3e202d325167c09d095fd3))
* **auth:** hydration-safe login + immediate redirect & refresh ([c3b0908](https://github.com/gifayen/englishlearn-app/commit/c3b09082cd43982a34487234c2cef29052de68f1))
* **auth:** immediate redirect + refresh after successful login ([6db0af9](https://github.com/gifayen/englishlearn-app/commit/6db0af99f48a73e5e1790f2ed63eb2c0fc75b2cd))
* **auth:** immediate redirect + refresh after successful login ([81457dd](https://github.com/gifayen/englishlearn-app/commit/81457ddd15e5b54695015846abacc2576e5cb451))
* **auth:** middleware redirects logged-in users away from auth pages ([e0ae174](https://github.com/gifayen/englishlearn-app/commit/e0ae1747ece1e73095521798ce132dede349c599))
* **auth:** sync client session to server cookie via /auth/callback ([d90d9d7](https://github.com/gifayen/englishlearn-app/commit/d90d9d738aa4ff3bf93f9e5fe7a7534743f65947))
* **login:** remove revalidate from client page to fix prerender error ([7c6c75c](https://github.com/gifayen/englishlearn-app/commit/7c6c75c0905462a05816aa076b6e050f4ddc7689))
* **reader:** forward cookies to API, await headers/params ([ce25b5f](https://github.com/gifayen/englishlearn-app/commit/ce25b5fbe60faaf02e13600da7811b267d4a52c8))
* **reader:** use relative fetch with same-origin cookies; redirect 401 to login ([e71e8af](https://github.com/gifayen/englishlearn-app/commit/e71e8af134031cf70e35106b05ac167c96ebe354))
* **texts API & reader page:** await cookies()/params and tighten auth ([9d5ee02](https://github.com/gifayen/englishlearn-app/commit/9d5ee02849ff64b2029b8c657de16cb1927bb6ba))
* texts API + reader page + middleware ([cdfa5de](https://github.com/gifayen/englishlearn-app/commit/cdfa5de6335fcaebdc0f9740618ba58042ca5633))
* 調整 middleware 放行公開 API + testimonials GET 改 anon client ([ed9908b](https://github.com/gifayen/englishlearn-app/commit/ed9908b451a5a6283fc54a188d7d27dc2b7dfbe3))
