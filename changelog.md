commit 0dcfa61ba43fc8c74f3cf34b146be90846a1392b
Merge: 4579847 dfeea7b
Author: neuxdotdev <neuxdev1@gmail.com>
Date: Fri Apr 10 21:47:58 2026 +0700

    Merge branch 'master' of https://github.com/neuxdotdev/libts-csrfx-auth

commit dfeea7b82ea68a077748aba04f5ef4f558567829
Author: neuxdotdev <neuxdev1@gmail.com>
Date: Fri Apr 10 21:47:41 2026 +0700

    ci: Add GitHub Actions workflow for npm package publishing

    This workflow runs tests and publishes a Node.js package to GitHub Packages upon release creation.

commit 45798478057f8706768a92768425503ae589a1f0
Author: neuxdotdev <neuxdev1@gmail.com>
Date: Fri Apr 10 21:43:50 2026 +0700

    0.1.1

commit b6bee80770a5ae5456a37163262132470ad86056
Author: neuxdotdev <neuxdev1@gmail.com>
Date: Fri Apr 10 21:43:31 2026 +0700

    chore(metadata): fixed matadata name & version to auto fetch pakcage.json

commit 0ff1aab3006650a4031e0bb407aaeed2b877f8fb
Author: neuxdotdev <neuxdev1@gmail.com>
Date: Fri Apr 10 21:40:54 2026 +0700

    chore(manifest): fix path readme and license

commit 225c258484b5e94e35d98d0020e9f971c006e138
Author: neuxdotdev <neuxdev1@gmail.com>
Date: Fri Apr 10 21:37:36 2026 +0700

    remove tmp file

commit 656f5886b18c25fad5bd948a4950d6dd2edeaf25
Merge: be1ab8c 61a4225
Author: neuxdotdev <neuxdev1@gmail.com>
Date: Fri Apr 10 21:35:36 2026 +0700

    Merge branch 'feature-env-example'

commit 61a4225de51040f5693550d5ee37c552f84aa5ed
Author: neuxdotdev <neuxdev1@gmail.com>
Date: Fri Apr 10 21:35:35 2026 +0700

    docs(env): add example environment configuration

    Add .env.example file with placeholders for BASE_URL, LOGIN_PATH, USER_EMAIL, USER_PASSWORD, and LOGOUT_PATH. Provide default values pointing to a sample server IP.

    Provide developers a template to configure authentication endpoints without exposing real credentials. Reduce setup friction and prevent accidental commits of secrets.

    Improves onboarding and security by encouraging environment variable usage. No functional changes to runtime code.

    Refs: none

    Test: manually verified that loadEnv() reads .env.example structure

    BREAKING CHANGE: NONE

commit be1ab8c2a605dd800578cbbef99d14a2304450b2
Author: neuxdotdev <neuxdev1@gmail.com>
Date: Thu Apr 9 12:21:18 2026 +0700

    chore(tests): add temporary diff file

    Add file 'a' containing a nested diff fragment (likely a

    placeholder or accidental commit).

    Purpose unclear from diff; may be used for testing or

    debugging.

    No expected impact on production code.

    Refs: N/A

    Test: N/A

    BREAKING CHANGE: NONE

commit e4c6607256467c8f680a4fd71190557077ee2e89
Author: neuxdotdev <neuxdev1@gmail.com>
Date: Thu Apr 9 12:21:18 2026 +0700

    chore(config): add editorconfig

    Add .editorconfig file with root=true, charset utf-8, LF line

    endings, and indentation rules for JS, TS, JSON, YAML, and MD.

    Standardize coding style across contributors and editors, reducing

    formatting inconsistencies and merge conflicts.

    Improves developer experience and code consistency. No runtime

    impact.

    Refs: N/A

    Test: N/A

    BREAKING CHANGE: NONE

commit 43f3faf4e89c742de7e055f4d401a2c0e7889f5c
Author: neuxdotdev <neuxdev1@gmail.com>
Date: Thu Apr 9 02:02:31 2026 +0700

    docs: init project
