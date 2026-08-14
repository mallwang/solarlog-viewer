#!/usr/bin/env node

var fs = require("fs");
var path = require("path");

// Script version for tracking
var SCRIPT_VERSION = "1.0.1";

// List of compromised packages and their versions
// Now supports multiple versions per package (array of versions)
var compromisedPackages = {
  "@adminide-stack/clock-tik-browser": ["12.0.24"],
  "@adminide-stack/yantra-mobile": ["12.0.33"],
  "@ahmedhfarag/ngx-perfect-scrollbar": ["20.0.20"],
  "@ahmedhfarag/ngx-virtual-scroller": ["4.0.4"],
  "@art-ws/common": ["2.0.22", "2.0.28"],
  "@art-ws/config-eslint": ["2.0.4", "2.0.5"],
  "@art-ws/config-ts": ["2.0.7", "2.0.8"],
  "@art-ws/db-context": ["2.0.24"],
  "@art-ws/di": ["2.0.28", "2.0.32"],
  "@art-ws/di-node": ["2.0.13"],
  "@art-ws/eslint": ["1.0.5", "1.0.6"],
  "@art-ws/fastify-http-server": ["2.0.24", "2.0.27"],
  "@art-ws/http-server": ["2.0.21", "2.0.25"],
  "@art-ws/openapi": ["0.1.9", "0.1.12"],
  "@art-ws/package-base": ["1.0.5", "1.0.6"],
  "@art-ws/prettier": ["1.0.5", "1.0.6"],
  "@art-ws/slf": ["2.0.15", "2.0.22"],
  "@art-ws/ssl-info": ["1.0.9", "1.0.10"],
  "@art-ws/web-app": ["1.0.3", "1.0.4"],
  "@arv-bedrock/auth": ["1.1.7", "1.1.8"],
  "@arv-bedrock/auth-admin": ["1.0.2", "1.0.3"],
  "@arv-bedrock/auth-sso": ["1.6.1", "1.6.2"],
  "@arv-bedrock/auth-sso-backend": ["1.7.1", "1.7.2"],
  "@arv-bedrock/logger": ["1.7.1", "1.7.2"],
  "@cacheable/memory": ["2.2.1"],
  "@cacheable/net": ["2.1.1"],
  "@cacheable/node-cache": ["3.1.2"],
  "@cacheable/utils": ["2.5.1"],
  "@crowdstrike/commitlint": ["8.1.1", "8.1.2"],
  "@crowdstrike/falcon-shoelace": ["0.4.1", "0.4.2"],
  "@crowdstrike/foundry-js": ["0.19.1", "0.19.2"],
  "@crowdstrike/glide-core": ["0.34.2", "0.34.3"],
  "@crowdstrike/logscale-dashboard": ["1.205.1", "1.205.2"],
  "@crowdstrike/logscale-file-editor": ["1.205.1", "1.205.2"],
  "@crowdstrike/logscale-parser-edit": ["1.205.1", "1.205.2"],
  "@crowdstrike/logscale-search": ["1.205.1", "1.205.2"],
  "@crowdstrike/tailwind-toucan-base": ["5.0.1", "5.0.2"],
  "@ctrl/deluge": ["7.2.1", "7.2.2"],
  "@ctrl/golang-template": ["1.4.2", "1.4.3"],
  "@ctrl/magnet-link": ["4.0.3", "4.0.4"],
  "@ctrl/ngx-codemirror": ["7.0.1", "7.0.2"],
  "@ctrl/ngx-csv": ["6.0.1", "6.0.2"],
  "@ctrl/ngx-emoji-mart": ["9.2.1", "9.2.2"],
  "@ctrl/ngx-rightclick": ["4.0.1", "4.0.2"],
  "@ctrl/qbittorrent": ["9.7.1", "9.7.2"],
  "@ctrl/react-adsense": ["2.0.1", "2.0.2"],
  "@ctrl/shared-torrent": ["6.3.1", "6.3.2"],
  "@ctrl/tinycolor": ["4.1.1", "4.1.2"],
  "@ctrl/torrent-file": ["4.1.1", "4.1.2"],
  "@ctrl/transmission": ["7.3.1"],
  "@ctrl/ts-base32": ["4.0.1", "4.0.2"],
  "@deliveroo/determinator": ["0.2.1"],
  "@deliveroo/reevent": ["1.0.1"],
  "@hestjs/core": ["0.2.1"],
  "@hestjs/cqrs": ["0.1.6"],
  "@hestjs/demo": ["0.1.2"],
  "@hestjs/eslint-config": ["0.1.2"],
  "@hestjs/logger": ["0.1.6"],
  "@hestjs/scalar": ["0.1.7"],
  "@hestjs/validation": ["0.1.6"],
  "@hubsync/web-sdk-react": ["6.3.7", "6.3.8", "6.3.9", "6.3.10", "6.3.11", "6.3.12", "6.3.13", "6.3.14", "6.3.15", "6.3.16", "6.3.17", "6.3.18", "6.3.19", "6.3.20", "6.3.21", "6.3.22", "6.3.23", "6.3.24", "6.3.25", "6.3.26", "6.3.27", "6.3.28", "6.3.29", "6.3.30", "6.3.31", "6.3.32", "6.3.33"],
  "@keyv/bigmap": ["6.0.0"],
  "@keyv/cloudflare-kv": ["6.0.0"],
  "@keyv/compress-brotli": ["6.0.0"],
  "@keyv/compress-gzip": ["6.0.0"],
  "@keyv/compress-lz4": ["6.0.0"],
  "@keyv/dynamo": ["6.0.0"],
  "@keyv/encrypt-node": ["6.0.0"],
  "@keyv/encrypt-web": ["6.0.0"],
  "@keyv/etcd": ["6.0.0"],
  "@keyv/memcache": ["6.0.0"],
  "@keyv/mongo": ["6.0.0"],
  "@keyv/mysql": ["6.0.0"],
  "@keyv/postgres": ["6.0.0"],
  "@keyv/redis": ["6.0.0"],
  "@keyv/serialize-msgpackr": ["6.0.0"],
  "@keyv/serialize-superjson": ["6.0.0"],
  "@keyv/sqlite": ["6.0.0"],
  "@keyv/test-suite": ["6.0.0"],
  "@keyv/valkey": ["6.0.0"],
  "@nativescript-community/arraybuffers": ["1.1.6", "1.1.7", "1.1.8"],
  "@nativescript-community/gesturehandler": ["2.0.35"],
  "@nativescript-community/perms": ["3.0.5", "3.0.6", "3.0.7", "3.0.8"],
  "@nativescript-community/sentry": ["4.6.43"],
  "@nativescript-community/sqlite": ["3.5.2", "3.5.3", "3.5.4", "3.5.5"],
  "@nativescript-community/text": ["1.6.9", "1.6.10", "1.6.11", "1.6.12", "1.6.13"],
  "@nativescript-community/typeorm": ["0.2.30", "0.2.31", "0.2.32", "0.2.33"],
  "@nativescript-community/ui-collectionview": ["6.0.6"],
  "@nativescript-community/ui-document-picker": ["1.1.27", "1.1.28"],
  "@nativescript-community/ui-drawer": ["0.1.30"],
  "@nativescript-community/ui-image": ["4.5.6"],
  "@nativescript-community/ui-label": ["1.3.35", "1.3.36", "1.3.37"],
  "@nativescript-community/ui-material-bottom-navigation": ["7.2.72", "7.2.73", "7.2.74", "7.2.75"],
  "@nativescript-community/ui-material-bottomsheet": ["7.2.72"],
  "@nativescript-community/ui-material-core": ["7.2.72", "7.2.73", "7.2.74", "7.2.75", "7.2.76"],
  "@nativescript-community/ui-material-core-tabs": ["7.2.72", "7.2.73", "7.2.74", "7.2.75", "7.2.76"],
  "@nativescript-community/ui-material-ripple": ["7.2.72", "7.2.73", "7.2.74", "7.2.75"],
  "@nativescript-community/ui-material-tabs": ["7.2.72", "7.2.73", "7.2.74", "7.2.75"],
  "@nativescript-community/ui-pager": ["14.1.36", "14.1.37", "14.1.38"],
  "@nativescript-community/ui-pulltorefresh": ["2.5.4", "2.5.5", "2.5.6", "2.5.7"],
  "@nebula.js/cli": ["7.1.2"],
  "@nebula.js/cli-build": ["7.1.2"],
  "@nebula.js/cli-sense": ["7.1.2"],
  "@nebula.js/cli-serve": ["7.1.2"],
  "@nebula.js/locale": ["0.6.2"],
  "@nebula.js/nucleus": ["0.5.1"],
  "@nebula.js/sn-action-button": ["2.3.1"],
  "@nebula.js/sn-animator": ["2.13.1"],
  "@nebula.js/sn-distributionplot": ["1.0.7"],
  "@nebula.js/sn-layout-container": ["4.4.1"],
  "@nebula.js/sn-line-chart": ["2.7.1"],
  "@nebula.js/sn-listbox": ["0.19.3"],
  "@nebula.js/sn-map": ["0.12.7"],
  "@nebula.js/sn-nav-menu": ["0.14.2"],
  "@nebula.js/sn-org-chart": ["1.7.1"],
  "@nebula.js/sn-shape": ["1.5.1"],
  "@nebula.js/sn-slider": ["0.20.1"],
  "@nebula.js/sn-tabbed-container": ["2.4.1"],
  "@nebula.js/snapshooter": ["0.6.1"],
  "@nebula.js/stardust": ["7.1.2"],
  "@nebula.js/test-utils": ["0.6.1"],
  "@nebula.js/theme": ["0.6.1"],
  "@nexe/config-manager": ["0.1.1"],
  "@nexe/eslint-config": ["0.1.1"],
  "@nexe/logger": ["0.1.3"],
  "@nstudio/angular": ["20.0.4", "20.0.5", "20.0.6"],
  "@nstudio/focus": ["20.0.4", "20.0.5", "20.0.6"],
  "@nstudio/nativescript-checkbox": ["2.0.6", "2.0.7", "2.0.8", "2.0.9"],
  "@nstudio/nativescript-loading-indicator": ["5.0.1", "5.0.2", "5.0.3", "5.0.4"],
  "@nstudio/ui-collectionview": ["5.1.11", "5.1.12", "5.1.13", "5.1.14"],
  "@nstudio/web": ["20.0.4"],
  "@nstudio/web-angular": ["20.0.4"],
  "@nstudio/xplat": ["20.0.5", "20.0.6", "20.0.7"],
  "@nstudio/xplat-utils": ["20.0.5", "20.0.6", "20.0.7"],
  "@onereach/authorizer-helper": ["0.0.11", "0.0.12", "0.0.13"],
  "@onereach/bandwidth-steps-voice-bxml": ["0.1.1", "0.1.2", "0.1.3"],
  "@onereach/billing-dto": ["27.2.1", "27.2.2", "27.2.3"],
  "@onereach/billing-shared": ["27.2.1", "27.2.2", "27.2.3"],
  "@onereach/cb-schema-translator": ["1.3.1", "1.3.2", "1.3.3"],
  "@onereach/channel-transformer": ["0.0.66", "0.0.67", "0.0.68"],
  "@onereach/channel-transformers": ["0.0.5", "0.0.6", "0.0.7"],
  "@onereach/ckeditor5-build-classic": ["30.0.1", "30.0.2", "30.0.3"],
  "@onereach/condition-builder": ["1.0.8", "1.0.9", "1.0.10"],
  "@onereach/content-builder": ["0.0.18", "0.0.19", "0.0.20"],
  "@onereach/content-builder-template-compiler": ["0.0.3", "0.0.4", "0.0.5"],
  "@onereach/expression-components": ["9.1.1", "9.1.2", "9.1.3"],
  "@onereach/font-icons": ["27.0.2", "27.0.3", "27.0.4"],
  "@onereach/get-version-data": ["3.1.2", "3.1.3", "3.1.4"],
  "@onereach/idw-apps": ["0.1.3", "0.1.4", "0.1.5"],
  "@onereach/idw-contracts": ["0.1.2", "0.1.3", "0.1.4"],
  "@onereach/idw-init-account-resources": ["1.0.1", "1.0.2", "1.0.3"],
  "@onereach/idw-sdk": ["0.1.2", "0.1.3", "0.1.4"],
  "@onereach/idw-ui-components": ["0.1.2", "0.1.3", "0.1.4"],
  "@onereach/lambda-invocation": ["1.2.1", "1.2.2", "1.2.3"],
  "@onereach/messengers-infobip-sdk": ["0.1.1", "0.1.2", "0.1.3"],
  "@onereach/or-browser": ["0.0.48", "0.0.49", "0.0.50"],
  "@onereach/or-browser-next": ["0.0.11", "0.0.12", "0.0.13"],
  "@onereach/or-content-builder-renderer": ["0.0.2", "0.0.3", "0.0.4"],
  "@onereach/or-file-uploader-next": ["0.0.8", "0.0.9", "0.0.10"],
  "@onereach/or-pro": ["1.13.1", "1.13.2", "1.13.3"],
  "@onereach/or-sdk-agent-cli": ["0.0.6", "0.0.7", "0.0.8"],
  "@onereach/orest-cli": ["2.4.1", "2.4.2", "2.4.3"],
  "@onereach/orest-input-cli": ["1.18.1", "1.18.2", "1.18.3"],
  "@onereach/orest-jest-presets": ["0.0.3", "0.0.4", "0.0.5"],
  "@onereach/orest-vue-demi-vue2": ["0.0.4", "0.0.5", "0.0.6"],
  "@onereach/orest-vue-demi-vue3": ["0.0.4", "0.0.5", "0.0.6"],
  "@onereach/orest-vue3": ["0.0.4", "0.0.5", "0.0.6"],
  "@onereach/phonenumber-interpreter": ["0.0.18", "0.0.19", "0.0.20"],
  "@onereach/pnpm-audit-junit": ["1.0.3", "1.0.4", "1.0.5"],
  "@onereach/postcss-scoped-selector": ["1.2.1", "1.2.2", "1.2.3"],
  "@onereach/regex-helper": ["0.5.16", "0.5.17", "0.5.18"],
  "@onereach/regular-expressions": ["0.5.23", "0.5.24", "0.5.25"],
  "@onereach/regular-expressions-test": ["0.0.4", "0.0.5", "0.0.6"],
  "@onereach/rwc-client": ["6.4.7", "6.4.8", "6.4.9"],
  "@onereach/salesforce-miaw-client": ["0.0.3", "0.0.4", "0.0.5"],
  "@onereach/si-a-button": ["0.0.3", "0.0.4", "0.0.5"],
  "@onereach/si-alert": ["0.4.11", "0.4.12", "0.4.13"],
  "@onereach/si-checkbox": ["0.6.5", "0.6.6", "0.6.7"],
  "@onereach/si-checkbox-group": ["0.3.5", "0.3.6", "0.3.7"],
  "@onereach/si-code": ["0.6.4", "0.6.5", "0.6.6"],
  "@onereach/si-collapsible-group": ["0.6.4", "0.6.5", "0.6.6"],
  "@onereach/si-copyable-text": ["0.4.11", "0.4.12", "0.4.13"],
  "@onereach/si-datepicker": ["0.4.5", "0.4.6", "0.4.7"],
  "@onereach/si-divider": ["0.4.11", "0.4.12", "0.4.13"],
  "@onereach/si-dropdown-advanced": ["0.4.5", "0.4.6", "0.4.7"],
  "@onereach/si-dropdown-simple": ["0.4.5", "0.4.6", "0.4.7"],
  "@onereach/si-header": ["0.4.11", "0.4.12", "0.4.13", "0.4.14"],
  "@onereach/si-list": ["0.7.4", "0.7.5", "0.7.6"],
  "@onereach/si-merge-tag-input": ["0.4.5", "0.4.6", "0.4.7"],
  "@onereach/si-radio-group": ["0.3.5", "0.3.6", "0.3.7"],
  "@onereach/si-root": ["0.9.4", "0.9.5", "0.9.6"],
  "@onereach/si-select": ["0.1.3", "0.1.4", "0.1.5"],
  "@onereach/si-step-chooser": ["0.4.4", "0.4.5", "0.4.6"],
  "@onereach/si-switch": ["0.4.5", "0.4.6", "0.4.7"],
  "@onereach/si-text-message": ["0.4.5", "0.4.6", "0.4.7"],
  "@onereach/si-textinput": ["0.5.5", "0.5.6", "0.5.7"],
  "@onereach/si-validated-timestring-input": ["0.3.5", "0.3.6", "0.3.7"],
  "@onereach/slack-helpers": ["1.0.3", "1.0.4", "1.0.5"],
  "@onereach/ssml-editor": ["2.0.12", "2.0.13", "2.0.14"],
  "@onereach/step-components": ["0.1.37", "0.1.38", "0.1.39"],
  "@onereach/step-conversation": ["1.0.41", "1.0.42", "1.0.43"],
  "@onereach/step-run-snowflake-query": ["0.1.1", "0.1.2", "0.1.3"],
  "@onereach/step-voice": ["7.0.32", "7.0.33", "7.0.34"],
  "@onereach/styles": ["27.0.2", "27.0.3", "27.0.4"],
  "@onereach/time-interpreter": ["1.0.30", "1.0.31", "1.0.32"],
  "@onereach/ts-memoize": ["1.0.2", "1.0.3", "1.0.4"],
  "@onereach/types-contacts-api": ["9.0.8", "9.0.9", "9.0.10"],
  "@onereach/ui-components": ["27.0.2", "27.0.3", "27.0.4"],
  "@onereach/ui-components-common": ["27.0.2", "27.0.3", "27.0.4"],
  "@onereach/ui-components-vue2": ["27.0.2", "27.0.3", "27.0.4"],
  "@onereach/v-event-calendar": ["0.1.22", "0.1.23", "0.1.24"],
  "@onereach/webform": ["0.3.13", "0.3.14", "0.3.15"],
  "@operato/board": ["9.0.36", "9.0.37", "9.0.38", "9.0.39", "9.0.40", "9.0.41", "9.0.42", "9.0.43", "9.0.44", "9.0.45", "9.0.46", "9.0.47", "9.0.48", "9.0.49", "9.0.50", "9.0.51"],
  "@operato/data-grist": ["9.0.29", "9.0.35", "9.0.36", "9.0.37"],
  "@operato/graphql": ["9.0.22", "9.0.35", "9.0.36", "9.0.37", "9.0.38", "9.0.39", "9.0.40", "9.0.41", "9.0.42", "9.0.43", "9.0.44", "9.0.45", "9.0.46"],
  "@operato/headroom": ["9.0.2", "9.0.35", "9.0.36", "9.0.37"],
  "@operato/help": ["9.0.35", "9.0.36", "9.0.37", "9.0.38", "9.0.39", "9.0.40", "9.0.41", "9.0.42", "9.0.43", "9.0.44", "9.0.45", "9.0.46"],
  "@operato/i18n": ["9.0.35", "9.0.36", "9.0.37"],
  "@operato/input": ["9.0.27", "9.0.35", "9.0.36", "9.0.37", "9.0.38", "9.0.39", "9.0.40", "9.0.41", "9.0.42", "9.0.43", "9.0.44", "9.0.45", "9.0.46", "9.0.47", "9.0.48"],
  "@operato/layout": ["9.0.35", "9.0.36", "9.0.37"],
  "@operato/popup": ["9.0.22", "9.0.35", "9.0.36", "9.0.37", "9.0.38", "9.0.39", "9.0.40", "9.0.41", "9.0.42", "9.0.43", "9.0.44", "9.0.45", "9.0.46", "9.0.49"],
  "@operato/pull-to-refresh": ["9.0.36", "9.0.37", "9.0.38", "9.0.39", "9.0.40", "9.0.41", "9.0.42"],
  "@operato/shell": ["9.0.22", "9.0.35", "9.0.36", "9.0.37", "9.0.38", "9.0.39"],
  "@operato/styles": ["9.0.2", "9.0.35", "9.0.36", "9.0.37"],
  "@operato/utils": ["9.0.22", "9.0.35", "9.0.36", "9.0.37", "9.0.38", "9.0.39", "9.0.40", "9.0.41", "9.0.42", "9.0.43", "9.0.44", "9.0.45", "9.0.46", "9.0.49"],
  "@or-sdk/account-settings": ["1.3.6", "1.3.7", "1.3.8"],
  "@or-sdk/accounts": ["2.3.5", "2.3.6", "2.3.7"],
  "@or-sdk/adapters": ["0.3.6", "0.3.7", "0.3.8"],
  "@or-sdk/agents": ["4.21.3", "4.21.4", "4.21.5"],
  "@or-sdk/api-tokens": ["1.4.2", "1.4.3", "1.4.4"],
  "@or-sdk/api-tokens-lambda": ["1.4.2", "1.4.3", "1.4.4"],
  "@or-sdk/apps": ["1.2.6", "1.2.7", "1.2.8"],
  "@or-sdk/auth": ["0.38.1", "0.38.2", "0.38.3"],
  "@or-sdk/authorizer": ["0.26.7", "0.26.8", "0.26.9"],
  "@or-sdk/base": ["0.44.4", "0.44.5", "0.44.6"],
  "@or-sdk/billing": ["27.2.1", "27.2.2", "27.2.3"],
  "@or-sdk/billing-internal": ["27.2.1", "27.2.2", "27.2.3"],
  "@or-sdk/bot-templates": ["2.2.5", "2.2.6", "2.2.7"],
  "@or-sdk/bots": ["1.7.1", "1.7.2", "1.7.3"],
  "@or-sdk/card-templates": ["2.2.5", "2.2.6", "2.2.7"],
  "@or-sdk/cards": ["1.2.5", "1.2.6", "1.2.7"],
  "@or-sdk/ccp": ["10.15.4", "10.15.5", "10.15.6"],
  "@or-sdk/chat": ["0.3.1", "0.3.2", "0.3.3"],
  "@or-sdk/contacts": ["4.7.5", "4.7.6", "4.7.7"],
  "@or-sdk/content-request": ["0.2.6", "0.2.7", "0.2.8"],
  "@or-sdk/data-hub": ["0.26.5", "0.26.6", "0.26.7"],
  "@or-sdk/data-hub-svc": ["2.3.5", "2.3.6", "2.3.7"],
  "@or-sdk/deployer": ["1.7.5", "1.7.6", "1.7.7"],
  "@or-sdk/deployments": ["2.1.5", "2.1.6", "2.1.7"],
  "@or-sdk/discovery": ["1.12.1", "1.12.2", "1.12.3"],
  "@or-sdk/druid": ["1.4.7", "1.4.8", "1.4.9"],
  "@or-sdk/event-manager": ["1.1.5", "1.1.6", "1.1.7"],
  "@or-sdk/files": ["3.11.6", "3.11.7", "3.11.8"],
  "@or-sdk/files-sync-node": ["0.1.8", "0.1.9", "0.1.10"],
  "@or-sdk/flow-templates": ["2.1.5", "2.1.6", "2.1.7"],
  "@or-sdk/flows": ["2.7.8", "2.7.9", "2.7.10"],
  "@or-sdk/graph": ["1.10.5", "1.10.6", "1.10.7"],
  "@or-sdk/hitl": ["0.41.1", "0.41.2", "0.41.3"],
  "@or-sdk/identifiers": ["0.27.6", "0.27.7", "0.27.8"],
  "@or-sdk/idw": ["9.0.4", "9.0.5", "9.0.6"],
  "@or-sdk/idw-public": ["1.6.6", "1.6.7", "1.6.8"],
  "@or-sdk/idw-skill": ["1.4.1", "1.4.2", "1.4.3"],
  "@or-sdk/invitations": ["1.4.8", "1.4.9", "1.4.10"],
  "@or-sdk/key-value-storage": ["0.28.6", "0.28.7", "0.28.8"],
  "@or-sdk/keys": ["1.2.6", "1.2.7", "1.2.8"],
  "@or-sdk/knowledge-models": ["0.25.5", "0.25.6", "0.25.7"],
  "@or-sdk/library": ["0.5.6", "0.5.7", "0.5.8"],
  "@or-sdk/library-categories": ["0.2.6", "0.2.7", "0.2.8"],
  "@or-sdk/library-source": ["0.4.5", "0.4.6", "0.4.7"],
  "@or-sdk/library-types-v1": ["9.0.1", "9.0.2", "9.0.3"],
  "@or-sdk/library-types-v2": ["9.0.1", "9.0.2", "9.0.3"],
  "@or-sdk/lookup": ["1.25.1", "1.25.2", "1.25.3"],
  "@or-sdk/markdowner": ["0.5.1", "0.5.2", "0.5.3"],
  "@or-sdk/mcp-tools": ["0.5.2", "0.5.3", "0.5.4"],
  "@or-sdk/notifications": ["1.7.5", "1.7.6", "1.7.7"],
  "@or-sdk/password": ["1.3.6", "1.3.7", "1.3.8"],
  "@or-sdk/payments": ["3.2.5", "3.2.6", "3.2.7"],
  "@or-sdk/permissions": ["2.8.1", "2.8.2", "2.8.3"],
  "@or-sdk/permissions-cli": ["1.4.1", "1.4.2", "1.4.3"],
  "@or-sdk/permissions-lambda": ["2.5.1", "2.5.2", "2.5.3"],
  "@or-sdk/pgsql": ["1.5.1", "1.5.2", "1.5.3"],
  "@or-sdk/providers": ["0.3.6", "0.3.7", "0.3.8"],
  "@or-sdk/qna": ["3.4.2", "3.4.3", "3.4.4"],
  "@or-sdk/queue-manager": ["1.4.6", "1.4.7", "1.4.8"],
  "@or-sdk/sdk-api": ["0.29.2", "0.29.3", "0.29.4"],
  "@or-sdk/settings": ["0.25.6", "0.25.7", "0.25.8"],
  "@or-sdk/sku-builder": ["2.5.1", "2.5.2", "2.5.3"],
  "@or-sdk/source": ["2.1.5", "2.1.6", "2.1.7"],
  "@or-sdk/source-api": ["1.1.1", "1.1.2", "1.1.3"],
  "@or-sdk/step-templates": ["2.2.5", "2.2.6", "2.2.7"],
  "@or-sdk/store": ["2.1.5", "2.1.6", "2.1.7"],
  "@or-sdk/tables": ["0.28.5", "0.28.6", "0.28.7"],
  "@or-sdk/tags": ["1.1.5", "1.1.6", "1.1.7"],
  "@or-sdk/tickets": ["1.9.5", "1.9.6", "1.9.7"],
  "@or-sdk/transcripts": ["1.2.5", "1.2.6", "1.2.7"],
  "@or-sdk/users": ["3.8.1", "3.8.2", "3.8.3"],
  "@or-sdk/view-templates": ["2.2.5", "2.2.6", "2.2.7"],
  "@or-sdk/views": ["3.1.5", "3.1.6", "3.1.7"],
  "@or-sdk/web-search": ["0.6.1", "0.6.2", "0.6.3"],
  "@ornikar/apollo-link-timeout": ["1.4.2", "1.4.3", "1.4.4", "1.4.5", "1.4.6", "1.4.7", "1.4.8", "1.4.9", "1.4.10", "1.4.11"],
  "@ornikar/babel-preset-base": ["6.0.3", "6.0.4", "6.0.5", "6.0.6", "6.0.7", "6.0.8", "6.0.9", "6.0.10", "6.0.11", "6.0.12", "6.0.13", "6.0.14"],
  "@ornikar/babel-preset-kitt-universal": ["8.0.3", "8.0.4", "8.0.5", "8.0.6", "8.0.7", "8.0.8", "8.0.9", "8.0.10", "8.0.11", "8.0.12"],
  "@ornikar/babel-preset-react": ["6.1.4", "6.1.5", "6.1.6", "6.1.7", "6.1.8", "6.1.9", "6.1.10", "6.1.11", "6.1.12", "6.1.13", "6.1.14"],
  "@ornikar/browserslist-config": ["8.0.3", "8.0.4", "8.0.5", "8.0.6", "8.0.7", "8.0.8", "8.0.9", "8.0.10", "8.0.11"],
  "@ornikar/commitlint-config": ["8.3.2", "8.3.3", "8.3.4", "8.3.5", "8.3.6", "8.3.7", "8.3.8", "8.3.9", "8.3.10", "8.3.11", "8.3.12"],
  "@ornikar/eslint-config": ["24.0.1", "24.0.2", "24.0.3", "24.0.4", "24.0.5", "24.0.6", "24.0.7", "24.0.8", "24.0.9", "24.0.10", "24.0.11", "24.0.12"],
  "@ornikar/eslint-config-babel": ["24.0.1", "24.0.2", "24.0.3", "24.0.4", "24.0.5", "24.0.6", "24.0.7", "24.0.8", "24.0.9", "24.0.10", "24.0.11", "24.0.12"],
  "@ornikar/eslint-config-babel-use": ["13.2.1", "13.2.2", "13.2.3", "13.2.4", "13.2.5", "13.2.6", "13.2.7", "13.2.8", "13.2.9", "13.2.10", "13.2.11", "13.2.12"],
  "@ornikar/eslint-config-formatjs": ["24.0.1", "24.0.2", "24.0.3", "24.0.4", "24.0.5", "24.0.6", "24.0.7", "24.0.8", "24.0.9", "24.0.10"],
  "@ornikar/eslint-config-node": ["12.2.1", "12.2.2", "12.2.3", "12.2.4", "12.2.5", "12.2.6", "12.2.7", "12.2.8", "12.2.9", "12.2.10"],
  "@ornikar/eslint-config-react": ["24.0.1", "24.0.2", "24.0.3", "24.0.4", "24.0.5", "24.0.6", "24.0.7", "24.0.8", "24.0.9", "24.0.10", "24.0.11"],
  "@ornikar/eslint-config-typescript": ["24.0.1", "24.0.2", "24.0.3", "24.0.4", "24.0.5", "24.0.6", "24.0.7", "24.0.8", "24.0.9", "24.0.10"],
  "@ornikar/eslint-config-typescript-nestjs": ["24.0.1", "24.0.2", "24.0.3", "24.0.4", "24.0.5", "24.0.6", "24.0.7", "24.0.8", "24.0.9", "24.0.10", "24.0.11"],
  "@ornikar/eslint-config-typescript-react": ["24.0.1", "24.0.2", "24.0.3", "24.0.4", "24.0.5", "24.0.6", "24.0.7", "24.0.8", "24.0.9", "24.0.10", "24.0.11"],
  "@ornikar/eslint-plugin-neverthrow": ["1.3.1", "1.3.2", "1.3.3", "1.3.4", "1.3.5", "1.3.6", "1.3.7", "1.3.8", "1.3.9", "1.3.10", "1.3.11", "1.3.12"],
  "@ornikar/eslint-plugin-ornikar": ["24.0.1", "24.0.2", "24.0.3", "24.0.4", "24.0.5", "24.0.6", "24.0.7", "24.0.8", "24.0.9", "24.0.10", "24.0.11"],
  "@ornikar/graphql-config": ["1.1.1", "1.1.2", "1.1.3", "1.1.4", "1.1.5", "1.1.6", "1.1.7", "1.1.8", "1.1.9", "1.1.10", "1.1.11"],
  "@ornikar/intl-config": ["10.0.2", "10.0.3", "10.0.4", "10.0.5", "10.0.6", "10.0.7", "10.0.8", "10.0.9", "10.0.10"],
  "@ornikar/jest-config": ["13.0.3", "13.0.4", "13.0.5", "13.0.6", "13.0.7", "13.0.8", "13.0.9", "13.0.10", "13.0.11", "13.0.12", "13.0.13"],
  "@ornikar/jest-config-react": ["18.0.2", "18.0.3", "18.0.4", "18.0.5", "18.0.6", "18.0.7", "18.0.8", "18.0.9", "18.0.10", "18.0.11"],
  "@ornikar/jest-config-react-native": ["17.0.2", "17.0.3", "17.0.4", "17.0.5", "17.0.6", "17.0.7", "17.0.8", "17.0.9", "17.0.10", "17.0.11", "17.0.12"],
  "@ornikar/jest-config-react-native-web": ["12.0.3", "12.0.4", "12.0.5", "12.0.6", "12.0.7", "12.0.8", "12.0.9", "12.0.10", "12.0.11", "12.0.12", "12.0.13"],
  "@ornikar/kitt2": ["1.0.1", "1.0.2", "1.0.3", "1.0.4", "1.0.5", "1.0.6", "1.0.7", "1.0.8", "1.0.9", "1.0.10", "1.0.11"],
  "@ornikar/lerna-config": ["11.0.1", "11.0.2", "11.0.3", "11.0.4", "11.0.5", "11.0.6", "11.0.7", "11.0.8", "11.0.9", "11.0.10", "11.0.11"],
  "@ornikar/monorepo-config": ["14.3.2", "14.3.3", "14.3.4", "14.3.5", "14.3.6", "14.3.7", "14.3.8", "14.3.9", "14.3.10", "14.3.11", "14.3.12", "14.3.13"],
  "@ornikar/postcss-config": ["9.1.2", "9.1.3", "9.1.4", "9.1.5", "9.1.6", "9.1.7", "9.1.8", "9.1.9", "9.1.10", "9.1.11", "9.1.12"],
  "@ornikar/prettier-config": ["9.0.3", "9.0.4", "9.0.5", "9.0.6", "9.0.7", "9.0.8", "9.0.9", "9.0.10", "9.0.11"],
  "@ornikar/prismic-components": ["0.0.2", "0.0.3", "0.0.4", "0.0.5", "0.0.6", "0.0.7", "0.0.8", "0.0.9", "0.0.10", "0.0.11", "0.0.12"],
  "@ornikar/react-modern-calendar-datepicker": ["3.2.1", "3.2.2", "3.2.3", "3.2.4", "3.2.5", "3.2.6", "3.2.7", "3.2.8", "3.2.9", "3.2.10", "3.2.11"],
  "@ornikar/react-native-svg-transformer": ["1.0.6", "1.0.7", "1.0.8", "1.0.9", "1.0.10", "1.0.11", "1.0.12", "1.0.13"],
  "@ornikar/renovate-config": ["9.0.2", "9.0.3", "9.0.4", "9.0.5", "9.0.6", "9.0.7", "9.0.8", "9.0.9", "9.0.10", "9.0.11", "9.0.12", "9.0.13"],
  "@ornikar/repo-config": ["15.3.3", "15.3.4", "15.3.5", "15.3.6", "15.3.7", "15.3.8", "15.3.9", "15.3.10", "15.3.11", "15.3.12", "15.3.13"],
  "@ornikar/repo-config-react": ["13.0.8", "13.0.9", "13.0.10", "13.0.11", "13.0.12", "13.0.13", "13.0.14", "13.0.15", "13.0.16", "13.0.17", "13.0.18", "13.0.19"],
  "@ornikar/repo-config-react-legacy-css": ["15.1.2", "15.1.3", "15.1.4", "15.1.5", "15.1.6", "15.1.7", "15.1.8", "15.1.9", "15.1.10", "15.1.11", "15.1.12", "15.1.13"],
  "@ornikar/rollup-config": ["11.1.2", "11.1.3", "11.1.4", "11.1.5", "11.1.6", "11.1.7", "11.1.8", "11.1.9", "11.1.10", "11.1.11", "11.1.12", "11.1.13"],
  "@ornikar/rollup-plugin-postcss": ["2.0.5", "2.0.6", "2.0.7", "2.0.8", "2.0.9", "2.0.10", "2.0.11", "2.0.12", "2.0.13", "2.0.14", "2.0.15"],
  "@ornikar/slate-react-fork": ["1.0.1", "1.0.2", "1.0.3", "1.0.4", "1.0.5", "1.0.6", "1.0.7", "1.0.8", "1.0.9", "1.0.10", "1.0.11"],
  "@ornikar/storybook-config": ["12.1.2", "12.1.3", "12.1.4", "12.1.5", "12.1.6", "12.1.7", "12.1.8", "12.1.9", "12.1.10"],
  "@ornikar/stylelint-config": ["14.0.3", "14.0.4", "14.0.5", "14.0.6", "14.0.7", "14.0.8", "14.0.9", "14.0.10", "14.0.11", "14.0.12", "14.0.13"],
  "@ornikar/typed-css-modules-loader": ["0.8.2", "0.8.3", "0.8.4", "0.8.5", "0.8.6", "0.8.7", "0.8.8", "0.8.9", "0.8.10", "0.8.11", "0.8.12"],
  "@ornikar/webpack-config": ["12.0.2", "12.0.3", "12.0.4", "12.0.5", "12.0.6", "12.0.7", "12.0.8", "12.0.9", "12.0.10", "12.0.11", "12.0.12"],
  "@picsart/ai-sdk": ["3.32.2"],
  "@picsart/gen-ai": ["2.55.11"],
  "@qlik/api": ["2.14.2"],
  "@qlik/browserslist-config": ["3.0.2"],
  "@qlik/carbon-core": ["2.1.1"],
  "@qlik/carboncopy": ["1.1.6"],
  "@qlik/design-tokens": ["1.3.13"],
  "@qlik/dts-bundler": ["2.0.3"],
  "@qlik/embed-react": ["2.5.3"],
  "@qlik/embed-runtime": ["1.6.4"],
  "@qlik/embed-svelte": ["1.1.4"],
  "@qlik/embed-web-components": ["1.7.3"],
  "@qlik/eslint-config": ["2.0.20"],
  "@qlik/eslint-config-base": ["0.1.1"],
  "@qlik/eslint-config-react": ["0.1.1"],
  "@qlik/eslint-config-svelte": ["0.1.1"],
  "@qlik/eslint-config-vue": ["0.1.1"],
  "@qlik/nebula-table-utils": ["2.6.9"],
  "@qlik/oxfmt-config": ["0.1.6"],
  "@qlik/oxlint-config": ["0.7.2"],
  "@qlik/prettier-config": ["1.0.3"],
  "@qlik/react-native-simple-grid": ["1.5.5"],
  "@qlik/runtime-module-loader": ["1.5.1"],
  "@qlik/sdk": ["0.28.1"],
  "@qlik/sprout-design-docs": ["1.0.2"],
  "@qlik/sprout-gesture": ["0.0.13"],
  "@qlik/sprout-icons": ["0.12.3"],
  "@qlik/sprout-react": ["6.45.3"],
  "@qlik/sprout-react-table": ["0.16.7"],
  "@qlik/tsconfig": ["1.0.3"],
  "@servicetitan/acquisition-functions": ["5.22.1", "5.22.2", "5.22.3", "5.22.4", "5.22.5", "5.22.6", "5.22.7"],
  "@servicetitan/admin-layout": ["2.4.3", "2.4.4", "2.4.5", "2.4.6", "2.4.7", "2.4.8", "2.4.9"],
  "@servicetitan/admin-sql-table": ["1.0.14", "1.0.15", "1.0.16", "1.0.17", "1.0.18", "1.0.19", "1.0.20"],
  "@servicetitan/ajax-handlers": ["38.1.1", "38.1.2", "38.1.3", "38.1.4", "38.1.5", "38.1.6", "38.1.7"],
  "@servicetitan/anvil-css-utilities": ["14.5.4", "14.5.5", "14.5.6", "14.5.7", "14.5.8", "14.5.9", "14.5.10"],
  "@servicetitan/anvil-fonts": ["14.5.4", "14.5.5", "14.5.6", "14.5.7", "14.5.8", "14.5.9", "14.5.10"],
  "@servicetitan/anvil-icon": ["0.5.1", "0.5.2", "0.5.3", "0.5.4", "0.5.5", "0.5.6", "0.5.7"],
  "@servicetitan/anvil-icons": ["14.5.4", "14.5.5", "14.5.6", "14.5.7", "14.5.8", "14.5.9", "14.5.10"],
  "@servicetitan/anvil-react": ["0.11.3", "0.11.4", "0.11.5", "0.11.6", "0.11.7", "0.11.8", "0.11.9"],
  "@servicetitan/anvil-themes": ["14.5.4", "14.5.5", "14.5.6", "14.5.7", "14.5.8", "14.5.9", "14.5.10"],
  "@servicetitan/anvil-token": ["0.4.1", "0.4.2", "0.4.3", "0.4.4", "0.4.5", "0.4.6", "0.4.7"],
  "@servicetitan/anvil2": ["3.9.1", "3.9.2", "3.9.3", "3.9.4", "3.9.5", "3.9.6", "3.9.7"],
  "@servicetitan/anvil2-codemods": ["0.11.2", "0.11.3", "0.11.4", "0.11.5", "0.11.6", "0.11.7", "0.11.8"],
  "@servicetitan/anvil2-ext-atlas": ["4.0.2", "4.0.3", "4.0.4", "4.0.5", "4.0.6", "4.0.7", "4.0.8"],
  "@servicetitan/anvil2-ext-charts": ["0.2.4", "0.2.5", "0.2.6", "0.2.7", "0.2.8", "0.2.9", "0.2.10"],
  "@servicetitan/anvil2-ext-common": ["0.7.1", "0.7.2", "0.7.3", "0.7.4", "0.7.5", "0.7.6", "0.7.7"],
  "@servicetitan/anvil2-ext-mwv": ["0.0.5", "0.0.6", "0.0.7", "0.0.8", "0.0.9", "0.0.10", "0.0.11"],
  "@servicetitan/anvil2-illustrations": ["1.0.2", "1.0.3", "1.0.4", "1.0.5", "1.0.6", "1.0.7", "1.0.8"],
  "@servicetitan/anvil2-mcp": ["0.0.9", "0.0.10", "0.0.11", "0.0.12", "0.0.13", "0.0.14", "0.0.15"],
  "@servicetitan/assist-ui": ["2.1.1", "2.1.2", "2.1.3", "2.1.4", "2.1.5", "2.1.6", "2.1.7"],
  "@servicetitan/assist-utils": ["1.1.2", "1.1.3", "1.1.4", "1.1.5", "1.1.6", "1.1.7", "1.1.8"],
  "@servicetitan/carto-charts-core": ["0.0.2", "0.0.3", "0.0.4", "0.0.5", "0.0.6", "0.0.7", "0.0.8"],
  "@servicetitan/carto-charts-react": ["0.0.2", "0.0.3", "0.0.4", "0.0.5", "0.0.6", "0.0.7", "0.0.8"],
  "@servicetitan/carto-charts-rn": ["0.0.2", "0.0.3", "0.0.4", "0.0.5", "0.0.6", "0.0.7", "0.0.8"],
  "@servicetitan/carto-react-kit": ["0.8.4", "0.8.5", "0.8.6", "0.8.7", "0.8.8", "0.8.9", "0.8.10"],
  "@servicetitan/carto-rn-kit": ["0.0.10", "0.0.11", "0.0.12", "0.0.13", "0.0.14", "0.0.15", "0.0.16"],
  "@servicetitan/carto-tokens": ["0.3.1", "0.3.2", "0.3.3", "0.3.4", "0.3.5", "0.3.6", "0.3.7"],
  "@servicetitan/component-usage": ["28.5.1", "28.5.2", "28.5.3", "28.5.4", "28.5.5", "28.5.6", "28.5.7"],
  "@servicetitan/confirm": ["41.3.1", "41.3.2", "41.3.3", "41.3.4", "41.3.5", "41.3.6", "41.3.7"],
  "@servicetitan/confirm-navigation": ["41.3.1", "41.3.2", "41.3.3", "41.3.4", "41.3.5", "41.3.6", "41.3.7"],
  "@servicetitan/contentful": ["0.0.3", "0.0.4", "0.0.5", "0.0.6", "0.0.7", "0.0.8", "0.0.9"],
  "@servicetitan/contentful-proxy": ["1.1.12", "1.1.13", "1.1.14", "1.1.15", "1.1.16", "1.1.17", "1.1.18"],
  "@servicetitan/cp-api": ["1.115.1", "1.115.2", "1.115.3", "1.115.4", "1.115.5", "1.115.6", "1.115.7"],
  "@servicetitan/cp-mfe": ["1.115.1", "1.115.2", "1.115.3", "1.115.4", "1.115.5", "1.115.6", "1.115.7"],
  "@servicetitan/cp-mfe-dev": ["1.115.1", "1.115.2", "1.115.3", "1.115.4", "1.115.5", "1.115.6", "1.115.7"],
  "@servicetitan/cp-react-hooks": ["1.115.1", "1.115.2", "1.115.3", "1.115.4", "1.115.5", "1.115.6", "1.115.7"],
  "@servicetitan/cp-ui": ["1.115.1", "1.115.2", "1.115.3", "1.115.4", "1.115.5", "1.115.6", "1.115.7"],
  "@servicetitan/culture": ["41.3.1", "41.3.2", "41.3.3", "41.3.4", "41.3.5", "41.3.6", "41.3.7"],
  "@servicetitan/data-query": ["41.3.1", "41.3.2", "41.3.3", "41.3.4", "41.3.5", "41.3.6", "41.3.7"],
  "@servicetitan/datadog-rum": ["38.1.1", "38.1.2", "38.1.3", "38.1.4", "38.1.5", "38.1.6", "38.1.7"],
  "@servicetitan/datetime-utils": ["41.3.1", "41.3.2", "41.3.3", "41.3.4", "41.3.5", "41.3.6", "41.3.7"],
  "@servicetitan/design-system": ["14.5.4", "14.5.5", "14.5.6", "14.5.7", "14.5.8", "14.5.9", "14.5.10"],
  "@servicetitan/docs-anvil-uikit-contrib": ["41.3.1", "41.3.2", "41.3.3", "41.3.4", "41.3.5", "41.3.6", "41.3.7"],
  "@servicetitan/docs-uikit": ["38.1.1", "38.1.2", "38.1.3", "38.1.4", "38.1.5", "38.1.6", "38.1.7"],
  "@servicetitan/document-title": ["2.4.1", "2.4.2", "2.4.3", "2.4.4", "2.4.5", "2.4.6", "2.4.7"],
  "@servicetitan/dte-pdf-editor": ["1.76.1", "1.76.2", "1.76.3", "1.76.4", "1.76.5", "1.76.6", "1.76.7"],
  "@servicetitan/dte-unlayer": ["0.150.1", "0.150.2", "0.150.3", "0.150.4", "0.150.5", "0.150.6", "0.150.7"],
  "@servicetitan/eh-module-communication": ["0.2.1", "0.2.2", "0.2.3", "0.2.4", "0.2.5", "0.2.6", "0.2.7"],
  "@servicetitan/error-boundary": ["38.1.1", "38.1.2", "38.1.3", "38.1.4", "38.1.5", "38.1.6", "38.1.7"],
  "@servicetitan/eslint-config": ["38.1.1", "38.1.2", "38.1.3", "38.1.4", "38.1.5", "38.1.6", "38.1.7"],
  "@servicetitan/eslint-plugin": ["38.1.1", "38.1.2", "38.1.3", "38.1.4", "38.1.5", "38.1.6", "38.1.7"],
  "@servicetitan/eslint-plugin-decorators-declare": ["12.8.15", "12.8.16", "12.8.17", "12.8.18", "12.8.19", "12.8.20", "12.8.21"],
  "@servicetitan/eslint-plugin-folder-schema": ["38.1.1", "38.1.2", "38.1.3", "38.1.4", "38.1.5", "38.1.6", "38.1.7"],
  "@servicetitan/eslint-plugin-mobx-6": ["12.8.15", "12.8.16", "12.8.17", "12.8.18", "12.8.19", "12.8.20"],
  "@servicetitan/eslint-plugin-processors-stub": ["12.8.15", "12.8.16", "12.8.17", "12.8.18", "12.8.19", "12.8.20", "12.8.21"],
  "@servicetitan/examples": ["1.2.5", "1.2.6", "1.2.7", "1.2.8", "1.2.9", "1.2.10", "1.2.11"],
  "@servicetitan/feature-spotlight": ["3.9.1", "3.9.2", "3.9.3", "3.9.4", "3.9.5", "3.9.6", "3.9.7"],
  "@servicetitan/folder-lint": ["38.1.1", "38.1.2", "38.1.3", "38.1.4", "38.1.5", "38.1.6", "38.1.7"],
  "@servicetitan/forge": ["0.5.1", "0.5.2", "0.5.3", "0.5.4", "0.5.5", "0.5.6", "0.5.7"],
  "@servicetitan/form": ["41.3.1", "41.3.2", "41.3.3", "41.3.4", "41.3.5", "41.3.6", "41.3.7"],
  "@servicetitan/form-state": ["41.3.1", "41.3.2", "41.3.3", "41.3.4", "41.3.5", "41.3.6", "41.3.7"],
  "@servicetitan/grid": ["0.0.63", "0.0.64", "0.0.65", "0.0.66", "0.0.67", "0.0.68", "0.0.69"],
  "@servicetitan/hammer-icon": ["1.2.1", "1.2.2", "1.2.3", "1.2.4", "1.2.5", "1.2.6", "1.2.7"],
  "@servicetitan/hammer-react": ["1.42.2", "1.42.3", "1.42.4", "1.42.5", "1.42.6", "1.42.7", "1.42.8"],
  "@servicetitan/hammer-token": ["3.1.1", "3.1.2", "3.1.3", "3.1.4", "3.1.5", "3.1.6", "3.1.7"],
  "@servicetitan/hash-browser-router": ["38.1.1", "38.1.2", "38.1.3", "38.1.4", "38.1.5", "38.1.6", "38.1.7"],
  "@servicetitan/help-center": ["1.0.8", "1.0.9", "1.0.10", "1.0.11", "1.0.12", "1.0.13", "1.0.14"],
  "@servicetitan/html-sketchapp": ["4.2.8", "4.2.9", "4.2.10", "4.2.11", "4.2.12", "4.2.13", "4.2.14"],
  "@servicetitan/install": ["38.1.1", "38.1.2", "38.1.3", "38.1.4", "38.1.5", "38.1.6", "38.1.7"],
  "@servicetitan/intl": ["7.2.1", "7.2.2", "7.2.3", "7.2.4", "7.2.5", "7.2.6", "7.2.7"],
  "@servicetitan/json-render-react": ["0.4.6", "0.4.7", "0.4.8", "0.4.9", "0.4.10", "0.4.11", "0.4.12"],
  "@servicetitan/kendo-theme": ["0.0.27", "0.0.28", "0.0.29", "0.0.30", "0.0.31", "0.0.32", "0.0.33"],
  "@servicetitan/ko-bridge": ["38.1.1", "38.1.2", "38.1.3", "38.1.4", "38.1.5", "38.1.6", "38.1.7"],
  "@servicetitan/launchdarkly-service": ["38.1.1", "38.1.2", "38.1.3", "38.1.4", "38.1.5", "38.1.6", "38.1.7"],
  "@servicetitan/lazy-module": ["38.1.1", "38.1.2", "38.1.3", "38.1.4", "38.1.5", "38.1.6", "38.1.7"],
  "@servicetitan/ld-type-generator": ["0.2.1", "0.2.2", "0.2.3", "0.2.4", "0.2.5", "0.2.6", "0.2.7"],
  "@servicetitan/line-item-editor": ["1.5.1", "1.5.2", "1.5.3", "1.5.4", "1.5.5", "1.5.6", "1.5.7"],
  "@servicetitan/link-item": ["41.3.1", "41.3.2", "41.3.3", "41.3.4", "41.3.5", "41.3.6", "41.3.7"],
  "@servicetitan/log-service": ["38.1.1", "38.1.2", "38.1.3", "38.1.4", "38.1.5", "38.1.6", "38.1.7"],
  "@servicetitan/marketing-direct-mail-components": ["20.1.1", "20.1.2", "20.1.3", "20.1.4", "20.1.5", "20.1.6", "20.1.7"],
  "@servicetitan/marketing-email-components": ["20.2.3", "20.2.4", "20.2.5", "20.2.6", "20.2.7", "20.2.8", "20.2.9"],
  "@servicetitan/marketing-form": ["0.1.2", "0.1.3", "0.1.4", "0.1.5", "0.1.6", "0.1.7", "0.1.8"],
  "@servicetitan/marketing-global-route": ["1.14.1", "1.14.2", "1.14.3", "1.14.4", "1.14.5", "1.14.6", "1.14.7"],
  "@servicetitan/marketing-integration-widgets": ["1.0.40", "1.0.41", "1.0.42", "1.0.43", "1.0.44", "1.0.45", "1.0.46"],
  "@servicetitan/marketing-route": ["1.2.1", "1.2.2", "1.2.3", "1.2.4", "1.2.5", "1.2.6", "1.2.7"],
  "@servicetitan/marketing-ui": ["9.3.1", "9.3.2", "9.3.3", "9.3.4", "9.3.5", "9.3.6", "9.3.7"],
  "@servicetitan/marketing-widgets": ["1.0.1", "1.0.2", "1.0.3", "1.0.4", "1.0.5", "1.0.6", "1.0.7"],
  "@servicetitan/measure-sheet-data": ["2.6.1", "2.6.2", "2.6.3", "2.6.4", "2.6.5", "2.6.6", "2.6.7"],
  "@servicetitan/mfe-quick-actions": ["0.5.49", "0.5.50", "0.5.51", "0.5.52", "0.5.53", "0.5.54", "0.5.55"],
  "@servicetitan/micro-frontend": ["0.0.4", "0.0.5", "0.0.6", "0.0.7", "0.0.8", "0.0.9", "0.0.10"],
  "@servicetitan/microfront": ["0.0.2", "0.0.3", "0.0.4", "0.0.5", "0.0.6", "0.0.7", "0.0.8"],
  "@servicetitan/microfront-auth": ["0.0.5", "0.0.6", "0.0.7", "0.0.8", "0.0.9", "0.0.10", "0.0.11"],
  "@servicetitan/microfront-tests": ["0.0.11", "0.0.12", "0.0.13", "0.0.14", "0.0.15", "0.0.16", "0.0.17"],
  "@servicetitan/microfront-utils": ["1.4.1", "1.4.2", "1.4.3", "1.4.4", "1.4.5", "1.4.6", "1.4.7"],
  "@servicetitan/modularpayments-webfields": ["1.0.53", "1.0.54", "1.0.55", "1.0.56", "1.0.57", "1.0.58", "1.0.59"],
  "@servicetitan/moneyout-api-client": ["1.29.1", "1.29.2", "1.29.3", "1.29.4", "1.29.5", "1.29.6", "1.29.7"],
  "@servicetitan/mpa-components": ["2.5.1", "2.5.2", "2.5.3", "2.5.4", "2.5.5", "2.5.6", "2.5.7"],
  "@servicetitan/navigation": ["14.1.1", "14.1.2", "14.1.3", "14.1.4", "14.1.5", "14.1.6", "14.1.7"],
  "@servicetitan/notifications": ["41.3.1", "41.3.2", "41.3.3", "41.3.4", "41.3.5", "41.3.6", "41.3.7"],
  "@servicetitan/onboarding-ui": ["18.5.1", "18.5.2", "18.5.3", "18.5.4", "18.5.5", "18.5.6", "18.5.7"],
  "@servicetitan/quick-actions": ["1.15.2", "1.15.3", "1.15.4", "1.15.5", "1.15.6", "1.15.7", "1.15.8"],
  "@servicetitan/react-hooks": ["7.7.1", "7.7.2", "7.7.3", "7.7.4", "7.7.5", "7.7.6", "7.7.7"],
  "@servicetitan/react-ioc": ["38.1.1", "38.1.2", "38.1.3", "38.1.4", "38.1.5", "38.1.6", "38.1.7"],
  "@servicetitan/responsive": ["6.1.1", "6.1.2", "6.1.3", "6.1.4", "6.1.5", "6.1.6", "6.1.7"],
  "@servicetitan/restrict-imports": ["38.1.1", "38.1.2", "38.1.3", "38.1.4", "38.1.5", "38.1.6", "38.1.7"],
  "@servicetitan/schema-comparison": ["0.1.3", "0.1.4", "0.1.5", "0.1.6", "0.1.7", "0.1.8", "0.1.9"],
  "@servicetitan/skeleton": ["9.2.4", "9.2.5", "9.2.6", "9.2.7", "9.2.8", "9.2.9", "9.2.10"],
  "@servicetitan/standalone-core-feature-gates": ["1.11.4", "1.11.5", "1.11.6", "1.11.7", "1.11.8", "1.11.9", "1.11.10"],
  "@servicetitan/standalone-feature-flags": ["2.3.2", "2.3.3", "2.3.4", "2.3.5", "2.3.6", "2.3.7", "2.3.8"],
  "@servicetitan/standalone-root": ["1.11.3", "1.11.4", "1.11.5", "1.11.6", "1.11.7", "1.11.8", "1.11.9"],
  "@servicetitan/standalone-tm-api": ["1.1.1", "1.1.2", "1.1.3", "1.1.4", "1.1.5", "1.1.6", "1.1.7"],
  "@servicetitan/standalone-ui": ["2.2.4", "2.2.5", "2.2.6", "2.2.7", "2.2.8", "2.2.9", "2.2.10"],
  "@servicetitan/startup": ["38.1.1", "38.1.2", "38.1.3", "38.1.4", "38.1.5", "38.1.6", "38.1.7"],
  "@servicetitan/startup-jest": ["2.2.1", "2.2.2", "2.2.3", "2.2.4", "2.2.5", "2.2.6", "2.2.7"],
  "@servicetitan/startup-mfe-compat": ["0.5.1", "0.5.2", "0.5.3", "0.5.4", "0.5.5", "0.5.6", "0.5.7"],
  "@servicetitan/startup-utils": ["38.1.1", "38.1.2", "38.1.3", "38.1.4", "38.1.5", "38.1.6", "38.1.7"],
  "@servicetitan/stylelint-config": ["38.1.1", "38.1.2", "38.1.3", "38.1.4", "38.1.5", "38.1.6", "38.1.7"],
  "@servicetitan/suppress-warnings": ["38.1.1", "38.1.2", "38.1.3", "38.1.4", "38.1.5", "38.1.6", "38.1.7"],
  "@servicetitan/table": ["41.3.1", "41.3.2", "41.3.3", "41.3.4", "41.3.5", "41.3.6", "41.3.7"],
  "@servicetitan/tanstack-query-mobx": ["6.2.1", "6.2.2", "6.2.3", "6.2.4", "6.2.5", "6.2.6", "6.2.7"],
  "@servicetitan/temporal-lite": ["3.4.1", "3.4.2", "3.4.3", "3.4.4", "3.4.5", "3.4.6", "3.4.7"],
  "@servicetitan/testing-library": ["6.6.1", "6.6.2", "6.6.3", "6.6.4", "6.6.5", "6.6.6", "6.6.7"],
  "@servicetitan/thoughtspot-theme": ["1.7.1", "1.7.2", "1.7.3", "1.7.4", "1.7.5", "1.7.6", "1.7.7"],
  "@servicetitan/time-zones": ["3.8.1", "3.8.2", "3.8.3", "3.8.4", "3.8.5", "3.8.6", "3.8.7"],
  "@servicetitan/titan-chat-ui": ["7.1.3", "7.1.4", "7.1.5", "7.1.6", "7.1.7", "7.1.8", "7.1.9"],
  "@servicetitan/titan-chat-ui-anvil2": ["9.0.1", "9.0.2", "9.0.3", "9.0.4", "9.0.5", "9.0.6", "9.0.7"],
  "@servicetitan/titan-chat-ui-common": ["9.0.1", "9.0.2", "9.0.3", "9.0.4", "9.0.5", "9.0.6", "9.0.7"],
  "@servicetitan/titan-chat-ui-cypress": ["2.1.3", "2.1.4", "2.1.5", "2.1.6", "2.1.7", "2.1.8", "2.1.9"],
  "@servicetitan/titan-chatbot-api": ["9.0.1", "9.0.2", "9.0.3", "9.0.4", "9.0.5", "9.0.6", "9.0.7"],
  "@servicetitan/titan-chatbot-client": ["2.1.3", "2.1.4", "2.1.5", "2.1.6", "2.1.7", "2.1.8", "2.1.9"],
  "@servicetitan/titan-chatbot-ui": ["7.1.3", "7.1.4", "7.1.5", "7.1.6", "7.1.7", "7.1.8", "7.1.9"],
  "@servicetitan/titan-chatbot-ui-anvil2": ["9.0.1", "9.0.2", "9.0.3", "9.0.4", "9.0.5", "9.0.6", "9.0.7"],
  "@servicetitan/titan-chatbot-ui-cypress": ["9.0.1", "9.0.2", "9.0.3", "9.0.4", "9.0.5", "9.0.6", "9.0.7"],
  "@servicetitan/tokens": ["12.9.1", "12.9.2", "12.9.3", "12.9.4", "12.9.5", "12.9.6", "12.9.7"],
  "@servicetitan/toolbelt-shared-registry": ["1.14.1", "1.14.2", "1.14.3", "1.14.4", "1.14.5", "1.14.6", "1.14.7"],
  "@servicetitan/uikit-docs": ["22.11.1", "22.11.2", "22.11.3", "22.11.4", "22.11.5", "22.11.6", "22.11.7"],
  "@servicetitan/unit-tests": ["0.0.2", "0.0.3", "0.0.4", "0.0.5", "0.0.6", "0.0.7", "0.0.8"],
  "@servicetitan/va-mfe-loader": ["1.1.1", "1.1.2", "1.1.3", "1.1.4", "1.1.5", "1.1.6", "1.1.7"],
  "@servicetitan/web-components": ["38.1.1", "38.1.2", "38.1.3", "38.1.4", "38.1.5", "38.1.6", "38.1.7"],
  "@servicetitan/widget-platform": ["5.6.1", "5.6.2", "5.6.3", "5.6.4", "5.6.5", "5.6.6", "5.6.7"],
  "@servicetitan/widget-platform-monolith": ["5.6.1", "5.6.2", "5.6.3", "5.6.4", "5.6.5", "5.6.6", "5.6.7"],
  "@teselagen/bio-parsers": ["0.4.30"],
  "@teselagen/bounce-loader": ["0.3.16", "0.3.17"],
  "@teselagen/file-utils": ["0.3.22"],
  "@teselagen/liquibase-tools": ["0.4.1"],
  "@teselagen/ove": ["0.7.40"],
  "@teselagen/range-utils": ["0.3.14", "0.3.15"],
  "@teselagen/react-list": ["0.8.19", "0.8.20"],
  "@teselagen/react-table": ["6.10.19", "6.10.20", "6.10.22"],
  "@teselagen/sequence-utils": ["0.3.34"],
  "@teselagen/ui": ["0.9.10"],
  "@thangved/callback-window": ["1.1.4"],
  "@thiennq/docs-viewer": ["1.6.2", "1.6.3", "1.6.4"],
  "@things-factory/attachment-base": ["9.0.43", "9.0.44", "9.0.45", "9.0.46", "9.0.47", "9.0.48", "9.0.49", "9.0.50"],
  "@things-factory/auth-base": ["9.0.43", "9.0.44", "9.0.45"],
  "@things-factory/email-base": ["9.0.42", "9.0.43", "9.0.44", "9.0.45", "9.0.46", "9.0.47", "9.0.48", "9.0.49", "9.0.50", "9.0.51", "9.0.52", "9.0.53", "9.0.54"],
  "@things-factory/env": ["9.0.42", "9.0.43", "9.0.44", "9.0.45"],
  "@things-factory/integration-base": ["9.0.43", "9.0.44", "9.0.45"],
  "@things-factory/integration-marketplace": ["9.0.43", "9.0.44", "9.0.45"],
  "@things-factory/shell": ["9.0.43", "9.0.44", "9.0.45"],
  "@tnf-dev/api": ["1.0.8"],
  "@tnf-dev/core": ["1.0.8"],
  "@tnf-dev/js": ["1.0.8"],
  "@tnf-dev/mui": ["1.0.8"],
  "@tnf-dev/react": ["1.0.8"],
  "@ui-ux-gang/devextreme-angular-rpk": ["24.1.7"],
  "@umacloud/cli-darwin-arm64": ["1.0.74"],
  "@umacloud/cli-darwin-x64": ["1.0.74"],
  "@umacloud/cli-linux-arm64": ["1.0.74"],
  "@umacloud/cli-linux-musl-arm64": ["1.0.74"],
  "@umacloud/cli-linux-musl-x64": ["1.0.74"],
  "@umacloud/cli-linux-x64": ["1.0.74"],
  "@umacloud/cli-win32-x64": ["1.0.74"],
  "@umacloud/knowledge": ["1.0.74"],
  "@workbench-stack/core": ["3.9.8"],
  "@yoobic/design-system": ["6.5.17"],
  "@yoobic/jpeg-camera-es6": ["1.0.13"],
  "@yoobic/yobi": ["8.7.53"],
  "airchief": ["0.3.1"],
  "airpilot": ["0.8.8"],
  "angulartics2": ["14.1.1", "14.1.2"],
  "ansi-regex": ["6.2.1"],
  "ansi-styles": ["6.2.2"],
  "axios": ["0.30.4", "1.14.1"],
  "babel-plugin-linaria-css-to-undefined": ["0.3.1", "0.3.2", "0.3.3", "0.3.4", "0.3.5", "0.3.6", "0.3.7", "0.3.8", "0.3.9", "0.3.10", "0.3.11", "0.3.12", "0.3.13", "0.3.14", "0.3.15", "0.3.16", "0.3.17"],
  "backslash": ["0.2.1"],
  "browser-webdriver-downloader": ["3.0.8"],
  "cache-manager": ["7.2.10"],
  "cacheable": ["2.5.1"],
  "cacheable-request": ["13.0.20"],
  "capacitor-notificationhandler": ["0.0.2", "0.0.3"],
  "capacitor-plugin-healthapp": ["0.0.2", "0.0.3"],
  "capacitor-plugin-ihealth": ["1.1.8", "1.1.9"],
  "capacitor-plugin-vonage": ["1.0.2", "1.0.3"],
  "capacitorandroidpermissions": ["0.0.4", "0.0.5"],
  "chalk": ["5.6.1"],
  "chalk-template": ["1.1.1"],
  "color-convert": ["3.1.1"],
  "color-name": ["2.0.1"],
  "color-string": ["2.1.1"],
  "config-cordova": ["0.8.5"],
  "conv-context-next": ["1.0.1", "1.0.2", "1.0.3", "1.0.4", "1.0.5", "1.0.6", "1.0.7", "1.0.8", "1.0.9", "1.0.10"],
  "cordova-plugin-voxeet2": ["1.0.24"],
  "cordova-voxeet": ["1.0.32"],
  "create-hest-app": ["0.1.9"],
  "db-evo": ["1.1.4", "1.1.5"],
  "debug": ["4.4.2"],
  "devextreme-angular-rpk": ["21.2.8"],
  "ecto": ["5.0.1"],
  "editable-contracts": ["0.0.12", "0.0.13", "0.0.14", "0.0.15", "0.0.16", "0.0.17", "0.0.18", "0.0.19", "0.0.20", "0.0.21", "0.0.22", "0.0.23", "0.0.24", "0.0.25", "0.0.26", "0.0.27"],
  "ember-browser-services": ["5.0.2", "5.0.3"],
  "ember-headless-form": ["1.1.2", "1.1.3"],
  "ember-headless-form-yup": ["1.0.1"],
  "ember-headless-table": ["2.1.5", "2.1.6"],
  "ember-url-hash-polyfill": ["1.0.12", "1.0.13"],
  "ember-velcro": ["2.2.1", "2.2.2"],
  "encounter-playground": ["0.0.2", "0.0.3", "0.0.4", "0.0.5"],
  "error-ex": ["1.3.3"],
  "eslint-config-crowdstrike": ["11.0.2", "11.0.3"],
  "eslint-config-crowdstrike-node": ["4.0.3", "4.0.4"],
  "eslint-config-teselagen": ["6.1.7", "6.1.8"],
  "eslint-plugin-folder-schema": ["1.0.6", "1.0.7", "1.0.8", "1.0.9", "1.0.10", "1.0.11", "1.0.12", "1.0.13", "1.0.14", "1.0.15", "1.0.16", "1.0.17", "1.0.18", "1.0.19", "1.0.20", "1.0.21"],
  "example-js-project": ["1.0.2", "1.0.3", "1.0.4", "1.0.5", "1.0.6", "1.0.7", "1.0.8", "1.0.9", "1.0.10", "1.0.11"],
  "file-entry-cache": ["11.1.6"],
  "flat-cache": ["6.1.24"],
  "folder-lint": ["1.0.6", "1.0.7", "1.0.8", "1.0.9", "1.0.10", "1.0.11", "1.0.12", "1.0.13", "1.0.14", "1.0.15", "1.0.16", "1.0.17", "1.0.18", "1.0.19", "1.0.20", "1.0.21"],
  "frontend-orb": ["4.4.1", "4.4.2", "4.4.3", "4.4.4", "4.4.5", "4.4.6", "4.4.7", "4.4.8", "4.4.9", "4.4.10", "4.4.11", "4.4.12", "4.4.13", "4.4.14", "4.4.15", "4.4.16", "4.4.17", "4.4.18"],
  "globalize-rpk": ["1.7.4"],
  "graphql-sequelize-teselagen": ["5.3.8", "5.3.9"],
  "hamus.js": ["0.4.1"],
  "has-ansi": ["6.0.1"],
  "html-to-base64-image": ["1.0.2"],
  "http-metrics-middleware": ["2.2.2"],
  "is-arrayish": ["0.3.3"],
  "json-rules-engine-simplified": ["0.2.1", "0.2.4"],
  "jumpgate": ["0.0.2"],
  "keyv": ["6.0.0"],
  "koa2-swagger-ui": ["5.11.1", "5.11.2"],
  "mcfly-semantic-release": ["1.3.1"],
  "mcp-knowledge-base": ["0.0.2"],
  "mcp-knowledge-graph": ["1.2.1"],
  "mobioffice-cli": ["1.0.3"],
  "monorepo-next": ["13.0.1", "13.0.2"],
  "mstate-angular": ["0.4.4"],
  "mstate-cli": ["0.4.7"],
  "mstate-dev-react": ["1.1.1"],
  "mstate-react": ["1.6.5"],
  "native-frontend-orb": ["1.1.4", "1.1.5", "1.1.6", "1.1.7", "1.1.8", "1.1.9", "1.1.10", "1.1.11", "1.1.12", "1.1.13", "1.1.14", "1.1.15", "1.1.16", "1.1.17", "1.1.18", "1.1.19"],
  "ng2-file-upload": ["7.0.2", "7.0.3", "8.0.1", "8.0.2", "8.0.3", "9.0.1"],
  "ngx-bootstrap": ["18.1.4", "19.0.3", "19.0.4", "20.0.3", "20.0.4", "20.0.5"],
  "ngx-color": ["10.0.1", "10.0.2"],
  "ngx-toastr": ["19.0.1", "19.0.2"],
  "ngx-trend": ["8.0.1"],
  "ngx-ws": ["1.1.5", "1.1.6"],
  "oradm-to-gql": ["35.0.14", "35.0.15"],
  "oradm-to-sqlz": ["1.1.2", "1.1.5"],
  "ove-auto-annotate": ["0.0.9", "0.0.10"],
  "picasso-plugin-hammer": ["2.11.6"],
  "picasso-plugin-q": ["2.11.6"],
  "picasso.js": ["2.11.6"],
  "pm2-gelf-json": ["1.0.4", "1.0.5"],
  "pob-test-package-in-monorepo": ["5.2.1", "5.2.2", "5.2.3", "5.2.4", "5.2.5", "5.2.6", "5.2.7", "5.2.8", "5.2.9", "5.2.10", "5.2.11", "5.2.12", "5.2.13", "5.2.14", "5.2.15", "5.2.16"],
  "pob-test-typescript-package-in-monorepo": ["4.2.1", "4.2.2", "4.2.3", "4.2.4", "4.2.5", "4.2.6", "4.2.7", "4.2.8", "4.2.9", "4.2.10", "4.2.11", "4.2.12", "4.2.13", "4.2.14", "4.2.15", "4.2.16", "4.2.17"],
  "printjs-rpk": ["1.6.1"],
  "qlik-chart-modules": ["1.1.1"],
  "qlik-modifiers": ["0.10.1"],
  "qlik-object-conversion": ["0.17.2"],
  "react-complaint-image": ["0.0.32", "0.0.35"],
  "react-jsonschema-form-conditionals": ["0.3.18", "0.3.21"],
  "react-jsonschema-form-extras": ["1.0.4"],
  "react-jsonschema-rxnt-extras": ["0.4.9"],
  "remark-preset-lint-crowdstrike": ["4.0.1", "4.0.2"],
  "rwc-client": ["0.29.10", "0.29.11", "0.29.12", "0.29.13", "0.29.14", "0.29.15", "0.29.16", "0.29.17", "0.29.18", "0.29.19"],
  "rxnt-authentication": ["0.0.3", "0.0.4", "0.0.5", "0.0.6"],
  "rxnt-healthchecks-nestjs": ["1.0.2", "1.0.3", "1.0.4", "1.0.5"],
  "rxnt-kue": ["1.0.4", "1.0.5", "1.0.6", "1.0.7"],
  "server-hemera-mongo": ["0.0.12"],
  "simple-swizzle": ["0.2.3"],
  "slice-ansi": ["7.1.1"],
  "sn-listbox": ["0.3.3"],
  "strip-ansi": ["7.1.1"],
  "supports-color": ["10.2.1"],
  "supports-hyperlinks": ["4.1.1"],
  "swc-plugin-component-annotate": ["1.9.1", "1.9.2"],
  "tbssnch": ["1.0.2"],
  "teselagen-interval-tree": ["1.1.2"],
  "tg-client-query-builder": ["2.14.4", "2.14.5"],
  "tg-redbird": ["1.3.1", "1.3.2"],
  "tg-seq-gen": ["1.0.9", "1.0.10"],
  "thangved-react-grid": ["1.0.3"],
  "ts-gaussian": ["3.0.5", "3.0.6"],
  "ts-imports": ["1.0.1", "1.0.2"],
  "tslint-folder-schema": ["1.0.6", "1.0.7", "1.0.8", "1.0.9", "1.0.10", "1.0.11", "1.0.12", "1.0.13", "1.0.14", "1.0.15", "1.0.16", "1.0.17", "1.0.18", "1.0.19", "1.0.20", "1.0.21"],
  "tvi-cli": ["0.1.5"],
  "umadev": ["1.0.74"],
  "ve-bamreader": ["0.2.6", "0.2.7"],
  "ve-editor": ["1.0.1", "1.0.2"],
  "verdaccio-okta-oauth": ["38.1.1", "38.1.2", "38.1.3", "38.1.4", "38.1.5", "38.1.6", "38.1.7", "38.1.8", "38.1.9", "38.1.10", "38.1.11", "38.1.12", "38.1.13", "38.1.14", "38.1.15", "38.1.16"],
  "verdaccio-tarball-local-storage": ["38.1.1", "38.1.2", "38.1.3", "38.1.4", "38.1.5", "38.1.6", "38.1.7", "38.1.8", "38.1.9", "38.1.10", "38.1.11", "38.1.12", "38.1.13", "38.1.14", "38.1.15", "38.1.16"],
  "verror-extra": ["6.0.1"],
  "voip-callkit": ["1.0.2", "1.0.3"],
  "wdio-web-reporter": ["0.1.3"],
  "workbench-browser-server": ["0.0.2"],
  "wrap-ansi": ["9.0.1"],
  "yargs-help-output": ["5.0.3"],
  "yoo-styles": ["6.0.326"],
};

// Configuration options
var config = {
  outputFormat: "console", // console, json, csv
  includePackageJson: true, // Check package.json files by default
  includeYarnLock: true, // Check yarn.lock files by default
  checkNodeModules: true, // Check node_modules directories by default
  maxDepth: 10,
  verbose: false,
};

// Parse command line arguments
function parseArguments() {
  var args = process.argv.slice(2);
  var parsedArgs = {
    directory: null,
    help: false,
    version: false,
  };

  for (var i = 0; i < args.length; i++) {
    var arg = args[i];
    if (arg === "--help" || arg === "-h") {
      parsedArgs.help = true;
    } else if (arg === "--version" || arg === "-v") {
      parsedArgs.version = true;
    } else if (arg === "--json") {
      config.outputFormat = "json";
    } else if (arg === "--csv") {
      config.outputFormat = "csv";
    } else if (arg === "--include-package-json") {
      config.includePackageJson = true;
    } else if (arg === "--exclude-package-json") {
      config.includePackageJson = false;
    } else if (arg === "--include-yarn-lock") {
      config.includeYarnLock = true;
    } else if (arg === "--exclude-yarn-lock") {
      config.includeYarnLock = false;
    } else if (arg === "--check-node-modules") {
      config.checkNodeModules = true;
    } else if (arg === "--exclude-node-modules") {
      config.checkNodeModules = false;
    } else if (arg === "--verbose") {
      config.verbose = true;
    } else if (arg.startsWith("--max-depth=")) {
      config.maxDepth = parseInt(arg.split("=")[1]) || 10;
    } else if (!arg.startsWith("-") && !parsedArgs.directory) {
      parsedArgs.directory = arg;
    }
  }

  return parsedArgs;
}

function showHelp() {
  console.log("NPM Compromised Package Checker v" + SCRIPT_VERSION);
  console.log("");
  console.log("🔍 Scanner for detecting compromised npm packages");
  console.log("   Based on 8th September 2025 npm security incident");
  console.log("");
  console.log(
    "Usage: node compromised-npm-packages-scanner.js [directory] [options]",
  );
  console.log("");
  console.log("Arguments:");
  console.log(
    "  directory                    Project root directory to scan (default: current directory)",
  );
  console.log("");
  console.log("Options:");
  console.log("  -h, --help                   Show this help message");
  console.log("  -v, --version                Show version number");
  console.log(
    "  --json                       Output results in JSON format for CI/CD integration",
  );
  console.log(
    "  --csv                        Output results in CSV format for reporting",
  );
  console.log(
    "  --exclude-package-json       Skip package.json files (enabled by default)",
  );
  console.log(
    "  --exclude-yarn-lock          Skip yarn.lock files (enabled by default)",
  );
  console.log(
    "  --exclude-node-modules       Skip node_modules directories (enabled by default)",
  );
  console.log(
    "  --max-depth=N                Maximum directory depth to scan (default: 10)",
  );
  console.log("  --verbose                    Enable detailed logging");
  console.log("");
  console.log("File Types Scanned by Default:");
  console.log("  ✅ package-lock.json         NPM lock files (always scanned)");
  console.log("  ✅ package.json              Direct dependencies");
  console.log("  ✅ yarn.lock                 Yarn lock files");
  console.log("  ✅ node_modules/             Actual installed packages");
  console.log("");
  console.log("Examples:");
  console.log("  node check-compromised-packages.js");
  console.log(
    "  node check-compromised-packages.js /path/to/org/projects --json",
  );
  console.log(
    "  node check-compromised-packages.js . --exclude-node-modules --verbose",
  );
  console.log(
    "  node check-compromised-packages.js /projects --csv > security-report.csv",
  );
  console.log("");
  console.log("Exit codes:");
  console.log("  0: No compromised packages found");
  console.log("  1: Compromised packages found or script error");
  console.log("");
  console.log("Security Note: Report any findings to cert@siemens.com");
}

// Enhanced logging function
function log(message, level) {
  level = level || "info";
  if (!config.verbose && level === "debug") return;

  if (config.outputFormat === "json" && level !== "error") {
    return; // Don't log to console in JSON mode unless it's an error
  }

  if (level === "error") {
    console.error(message);
  } else {
    console.log(message);
  }
}

// Function to recursively find all lock files
function findLockFiles(dir, currentDepth) {
  currentDepth = currentDepth || 0;
  var lockFiles = [];

  if (currentDepth > config.maxDepth) {
    log(
      "⚠️  Reached maximum depth (" + config.maxDepth + ") at: " + dir,
      "debug",
    );
    return lockFiles;
  }

  function searchDirectory(currentDir, depth) {
    try {
      log(
        "🔍 Scanning directory: " + (path.relative(dir, currentDir) || "."),
        "debug",
      );

      // Show progress for larger directories
      if (depth === 0 || currentDir.includes("node_modules")) {
        log("📁 Searching: " + (path.relative(dir, currentDir) || "."));
      }
      var items = fs.readdirSync(currentDir);

      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var fullPath = path.join(currentDir, item);

        try {
          var stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            var shouldSkip =
              item === ".git" ||
              item === "dist" ||
              item === "build" ||
              item === "coverage" ||
              item === "tmp" ||
              item === "temp" ||
              item.startsWith(".");

            if (item === "node_modules") {
              if (config.checkNodeModules) {
                log("🔍 Scanning node_modules at: " + fullPath, "debug");
                searchDirectory(fullPath, depth + 1);
              }
            } else if (!shouldSkip && depth < config.maxDepth) {
              searchDirectory(fullPath, depth + 1);
            }
          } else {
            if (item === "package-lock.json") {
              lockFiles.push({ path: fullPath, type: "npm" });
            } else if (config.includeYarnLock && item === "yarn.lock") {
              lockFiles.push({ path: fullPath, type: "yarn" });
            } else if (config.includePackageJson && item === "package.json") {
              lockFiles.push({ path: fullPath, type: "package" });
            }
          }
        } catch (statError) {
          log(
            "⚠️  Cannot access " + fullPath + ": " + statError.message,
            "debug",
          );
        }
      }
    } catch (readError) {
      log(
        "⚠️  Cannot read directory " + currentDir + ": " + readError.message,
        "debug",
      );
    }
  }

  searchDirectory(dir, currentDepth);
  return lockFiles;
}

// Check individual package
function checkSinglePackage(packageName, version, results, location) {
  if (compromisedPackages[packageName]) {
    var compromisedVersions = compromisedPackages[packageName];
    // Always treat as array
    if (!Array.isArray(compromisedVersions)) {
      compromisedVersions = [compromisedVersions];
    }
    var isCompromised = compromisedVersions.includes(version);
    var packageResult = {
      name: packageName,
      version: version,
      isCompromised: isCompromised,
      expectedCompromisedVersion: compromisedVersions,
      location: location,
      riskLevel: isCompromised ? "CRITICAL" : "LOW",
    };
    results.foundPackages.push(packageResult);
    if (isCompromised) {
      results.foundCompromised.push(packageResult);
    }
  }
}

// Enhanced package checking
function checkPackageInLockFile(lockFile) {
  var results = {
    file: lockFile.path,
    type: lockFile.type,
    foundCompromised: [],
    foundPackages: [],
    errors: [],
    metadata: {
      fileSize: 0,
      scanTime: 0,
    },
  };

  var startTime = Date.now();

  try {
    var content = fs.readFileSync(lockFile.path, "utf8");
    results.metadata.fileSize = content.length;

    if (lockFile.type === "npm") {
      results = checkNpmLockFile(content, results);
    } else if (lockFile.type === "yarn") {
      results = checkYarnLockFile(content, results);
    } else if (lockFile.type === "package") {
      results = checkPackageJsonFile(content, results);
    }
  } catch (error) {
    results.errors.push(
      "Error reading " + lockFile.path + ": " + error.message,
    );
  }

  results.metadata.scanTime = Date.now() - startTime;
  return results;
}

function checkNpmLockFile(content, results) {
  var packageLock = JSON.parse(content);

  // Check dependencies section (older npm versions)
  if (packageLock.dependencies) {
    checkDependenciesRecursive(packageLock.dependencies, results, 0);
  }

  // Check packages section (npm v7+)
  if (packageLock.packages) {
    for (var packagePath in packageLock.packages) {
      if (packageLock.packages.hasOwnProperty(packagePath)) {
        if (packagePath === "") continue; // Skip root package

        var packageInfo = packageLock.packages[packagePath];
        // Extract the package name after the last 'node_modules/'
        var lastNodeModulesIdx = packagePath.lastIndexOf("node_modules/");
        var namePath =
          lastNodeModulesIdx !== -1
            ? packagePath.substring(lastNodeModulesIdx + "node_modules/".length)
            : packagePath;
        // If scoped (starts with @), take first two segments, else first segment
        var segments = namePath.split("/");
        var packageName =
          segments[0].startsWith("@") && segments.length > 1
            ? segments[0] + "/" + segments[1]
            : segments[0];

        if (packageInfo.version) {
          checkSinglePackage(
            packageName,
            packageInfo.version,
            results,
            packagePath,
          );
        }
      }
    }
  }

  return results;
}

function checkYarnLockFile(content, results) {
  var lines = content.split("\n");
  var currentPackage = null;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();

    if (line.includes("@") && line.includes(":")) {
      var parts = line.split("@");
      if (parts.length >= 2) {
        currentPackage = parts[0].replace(/"/g, "");
      }
    }

    if (line.startsWith("version ") && currentPackage) {
      var version = line.replace("version ", "").replace(/"/g, "");
      checkSinglePackage(currentPackage, version, results, "yarn");
      currentPackage = null;
    }
  }

  return results;
}

function checkPackageJsonFile(content, results) {
  var packageJson = JSON.parse(content);

  [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ].forEach(function (depType) {
    if (packageJson[depType]) {
      for (var pkg in packageJson[depType]) {
        if (packageJson[depType].hasOwnProperty(pkg)) {
          var version = packageJson[depType][pkg].replace(/[\^~><=]/g, "");
          checkSinglePackage(pkg, version, results, depType);
        }
      }
    }
  });

  return results;
}

function checkDependenciesRecursive(deps, results, depth) {
  if (!deps) return;

  for (var packageName in deps) {
    if (deps.hasOwnProperty(packageName)) {
      var packageInfo = deps[packageName];
      if (packageInfo.version) {
        checkSinglePackage(
          packageName,
          packageInfo.version,
          results,
          "depth:" + depth,
        );
      }

      if (packageInfo.dependencies) {
        checkDependenciesRecursive(
          packageInfo.dependencies,
          results,
          depth + 1,
        );
      }
    }
  }
}

function outputResults(
  projectRoot,
  lockFiles,
  allResults,
  totalFoundCompromised,
  totalFoundPackages,
  allErrors,
  scanDuration,
) {
  if (config.outputFormat === "json") {
    var jsonOutput = {
      timestamp: new Date().toISOString(),
      scriptVersion: SCRIPT_VERSION,
      scanPath: projectRoot,
      scanDurationMs: scanDuration,
      summary: {
        filesScanned: lockFiles.length,
        packagesChecked: Object.keys(compromisedPackages).length,
        totalFoundPackages: totalFoundPackages,
        totalFoundCompromised: totalFoundCompromised,
        errors: allErrors.length,
        riskLevel: totalFoundCompromised > 0 ? "CRITICAL" : "LOW",
      },
      compromisedPackagesList: compromisedPackages,
      results: allResults,
      errors: allErrors,
    };
    // Print compromised versions as comma-separated in JSON output
    function replacer(key, value) {
      if (key === "expectedCompromisedVersion" && Array.isArray(value)) {
        return value.join(", ");
      }
      return value;
    }
    console.log(JSON.stringify(jsonOutput, replacer, 2));
  } else if (config.outputFormat === "csv") {
    console.log(
      "File,Type,PackageName,Version,IsCompromised,ExpectedCompromisedVersion,Location,RiskLevel",
    );
    for (var i = 0; i < allResults.length; i++) {
      var result = allResults[i];
      for (var j = 0; j < result.foundPackages.length; j++) {
        var pkg = result.foundPackages[j];
        var expectedVersions = Array.isArray(pkg.expectedCompromisedVersion)
          ? pkg.expectedCompromisedVersion.join(";")
          : pkg.expectedCompromisedVersion;
        console.log(
          [
            '"' + result.relativePath + '"',
            result.type,
            pkg.name,
            pkg.version,
            pkg.isCompromised,
            expectedVersions,
            '"' + pkg.location + '"',
            pkg.riskLevel,
          ].join(","),
        );
      }
    }
  } else {
    outputConsoleResults(
      projectRoot,
      lockFiles,
      allResults,
      totalFoundCompromised,
      totalFoundPackages,
      allErrors,
      scanDuration,
    );
  }
}

function outputConsoleResults(
  projectRoot,
  lockFiles,
  allResults,
  totalFoundCompromised,
  totalFoundPackages,
  allErrors,
  scanDuration,
) {
  log("\n==========================================");
  log("📊 SECURITY SCAN SUMMARY");
  log("==========================================");
  log("🕐 Scan completed in " + scanDuration + "ms");
  log("📂 Files scanned: " + lockFiles.length);
  log(
    "📦 Compromised packages checked: " +
      Object.keys(compromisedPackages).length,
  );
  log("🔍 Potentially affected package instances found: " + totalFoundPackages);
  log("🚨 COMPROMISED packages found: " + totalFoundCompromised);
  if (allErrors.length > 0) {
    log("❌ Errors encountered: " + allErrors.length);
  }
  log("==========================================\n");

  if (totalFoundCompromised > 0) {
    log("🚨 CRITICAL SECURITY ALERT: COMPROMISED PACKAGES DETECTED");
    log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    for (var i = 0; i < allResults.length; i++) {
      var result = allResults[i];
      if (result.foundCompromised.length > 0) {
        log("\n📁 " + result.relativePath + " (" + result.type + "):");
        result.foundCompromised.forEach(function (pkg) {
          log(
            "   ❌ " + pkg.name + "@" + pkg.version + " [" + pkg.location + "]",
          );
        });
      }
    }
    log("\n⚠️  IMMEDIATE ACTION REQUIRED:");
    log("   1. 🛑 Stop deployment of affected applications immediately");
    log("   2. 🔄 Remove or update compromised packages to safe versions");
    log("   3. 🔐 Rotate ALL API keys, database credentials, and auth tokens");
    log("   4. 📧 Report findings to cert@siemens.com immediately");
    log("   5. 🔍 Audit git history for unauthorized changes");
    log("   6. 🌐 Monitor network traffic for suspicious activity");
    log("   7. 📋 Document incident for compliance reporting");
  } else {
    log("✅ SECURITY STATUS: NO COMPROMISED PACKAGES DETECTED");
    log("   All scanned packages are using safe versions.");
  }

  // Only show detailed output if there are compromised packages
  if (totalFoundCompromised > 0) {
    log("\n📋 Detailed compromised package locations:");
    for (var i = 0; i < allResults.length; i++) {
      var result = allResults[i];
      var compromisedInFile = result.foundPackages.filter(function (pkg) {
        return pkg.isCompromised;
      });
      if (compromisedInFile.length > 0) {
        log("\n📁 In " + result.relativePath + " (" + result.type + "):");
        compromisedInFile.forEach(function (pkg) {
          log(
            "   ❌ COMPROMISED - " +
              pkg.name +
              "@" +
              pkg.version +
              " [" +
              pkg.location +
              "]",
          );
        });
      }
    }
  }

  // Optional: Show detailed safe package summary only with --verbose flag
  if (totalFoundPackages > 0 && config.verbose && totalFoundCompromised === 0) {
    log(
      "\n📋 Detailed summary of potentially affected packages (all safe versions):",
    );
    var packageSummary = {};
    for (var i = 0; i < allResults.length; i++) {
      var result = allResults[i];
      result.foundPackages.forEach(function (pkg) {
        if (!packageSummary[pkg.name]) {
          packageSummary[pkg.name] = {
            name: pkg.name,
            safeVersions: [],
            compromisedVersion: pkg.expectedCompromisedVersion,
            count: 0,
          };
        }
        if (packageSummary[pkg.name].safeVersions.indexOf(pkg.version) === -1) {
          packageSummary[pkg.name].safeVersions.push(pkg.version);
        }
        packageSummary[pkg.name].count++;
      });
    }

    for (var pkgName in packageSummary) {
      if (packageSummary.hasOwnProperty(pkgName)) {
        var summary = packageSummary[pkgName];
        log(
          "   ✅ " + summary.name + ": " + summary.count + " instance(s) found",
        );
        log("      Safe versions: " + summary.safeVersions.join(", "));
        log(
          "      Compromised version to avoid: " + summary.compromisedVersion,
        );
      }
    }
  }

  if (totalFoundCompromised === 0 && totalFoundPackages === 0) {
    log(
      "✅ None of the compromised packages found in any of the scanned projects",
    );
  }

  if (allErrors.length > 0) {
    log("\n⚠️  Scan errors (manual review required):");
    allErrors.forEach(function (error) {
      log("   • " + error);
    });
  }

  log("\n📝 For help: node check-compromised-packages.js --help");
  log("💡 Tip: Use --json for CI/CD integration or --csv for reporting");
}

function main() {
  var args = parseArguments();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  if (args.version) {
    console.log("v" + SCRIPT_VERSION);
    process.exit(0);
  }

  var projectRoot = args.directory || process.cwd();
  projectRoot = path.resolve(projectRoot);

  if (!fs.existsSync(projectRoot)) {
    log("❌ Directory not found: " + projectRoot, "error");
    process.exit(1);
  }

  var stat = fs.statSync(projectRoot);
  if (!stat.isDirectory()) {
    log("❌ Path is not a directory: " + projectRoot, "error");
    process.exit(1);
  }

  var scanStartTime = Date.now();
  log("🔍 Starting comprehensive security scan...");
  log("📂 Scanning: " + projectRoot);
  log("🔧 Version: v" + SCRIPT_VERSION);
  log(
    "📋 File types: package-lock.json" +
      (config.includePackageJson ? ", package.json" : "") +
      (config.includeYarnLock ? ", yarn.lock" : "") +
      (config.checkNodeModules ? ", node_modules" : ""),
  );

  var lockFiles = findLockFiles(projectRoot);

  if (lockFiles.length === 0) {
    var fileTypes =
      "package-lock.json" +
      (config.includePackageJson ? ", package.json" : "") +
      (config.includeYarnLock ? ", yarn.lock" : "") +
      (config.checkNodeModules ? ", node_modules" : "");
    var message =
      "No dependency files (" +
      fileTypes +
      ") found in the specified directory tree.";
    if (config.outputFormat === "json") {
      console.log(
        JSON.stringify({
          status: "no_files",
          message: message,
          timestamp: new Date().toISOString(),
          scriptVersion: SCRIPT_VERSION,
        }),
      );
    } else {
      log("📂 " + message);
      log("💡 Tip: Ensure your projects have dependency files to scan");
    }
    process.exit(0);
  }

  log("📂 Found " + lockFiles.length + " lock file(s):");
  for (var i = 0; i < lockFiles.length; i++) {
    var relativePath = path.relative(projectRoot, lockFiles[i].path);
    log("   • " + relativePath + " (" + lockFiles[i].type + ")");
  }

  var totalFoundCompromised = 0;
  var totalFoundPackages = 0;
  var allResults = [];
  var allErrors = [];

  for (var fileIndex = 0; fileIndex < lockFiles.length; fileIndex++) {
    var lockFile = lockFiles[fileIndex];
    var relativePath = path.relative(projectRoot, lockFile.path);

    log("🔍 Scanning: " + relativePath + "...");

    var result = checkPackageInLockFile(lockFile);
    result.relativePath = relativePath;

    if (result.errors.length > 0) {
      allErrors = allErrors.concat(result.errors);
      log(
        "❌ Errors in " + relativePath + ": " + result.errors.join(", "),
        "error",
      );
      continue;
    }

    allResults.push(result);
    totalFoundCompromised += result.foundCompromised.length;
    totalFoundPackages += result.foundPackages.length;

    if (result.foundCompromised.length > 0) {
      log(
        "   🚨 CRITICAL: " +
          result.foundCompromised.length +
          " compromised package(s) found!",
      );
    } else if (result.foundPackages.length > 0) {
      log(
        "   ✅ " +
          result.foundPackages.length +
          " potentially affected instances found (but using safe versions)",
      );
    } else {
      log("   ✅ No affected packages found");
    }
  }

  var scanDuration = Date.now() - scanStartTime;

  outputResults(
    projectRoot,
    lockFiles,
    allResults,
    totalFoundCompromised,
    totalFoundPackages,
    allErrors,
    scanDuration,
  );

  process.exit(totalFoundCompromised > 0 ? 1 : 0);
}

// Run the checker
main();
