/* The game's default name and branding: the ONE place they are written (docs/MASTER_GAME_GUIDE.md §5.2). Everything else
   uses tokens ({{GAME_NAME}}, {{GAME_INITIALS}}, …) or Z.resolveText. The super admin changes these for everyone in
   Arcade Management → FSLG Config; games/fslg_admin.py reads the same JSON below as its defaults. Loads right after
   samaru-data.js. Data only. */
(function (r) { var C =
{"gameName": "Freshers School Life", "gameShortName": "FSLG", "initialsOverride": "FSLG", "tagline": "One school, a thousand stories.", "author": "Muhammad Iliyasu Bugaje", "primaryColour": "#f59e0b", "secondaryColour": "#0f766e", "currencyName": "naira", "currencySymbol": "₦"}
; r.GameConfigDefault = C; var D = r.SamaruData; if (D && !D.CONFIG) { D.CONFIG = {}; for (var k in C) D.CONFIG[k] = C[k]; D.CONFIG.configVersion = 0; } })(typeof self !== "undefined" ? self : this);
