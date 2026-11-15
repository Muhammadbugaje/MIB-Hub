One file per game, named <slug>.txt, listing static files the game loads by itself (not through a <script> tag in the
play page): data files, images, extra sounds. One path per line, relative to static/ (e.g. img/games/maglev/track.png);
a path ending in "/" includes every file in that folder. Lines starting with # are comments.
These are added to the game's offline package (games/offline.py). games/tests/test_offline.py fails when a game page
refers to a static file that is not in its package.
