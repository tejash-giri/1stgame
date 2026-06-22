/**
 * ═══════════════════════════════════════════════════════════
 * BLOCK PUZZLE — Level Configuration v2
 * ═══════════════════════════════════════════════════════════
 *
 * Shape IDs match keys in SHAPE_ID_MAP → SHAPES (in game.js):
 *
 * Dots:       1x1
 * Squares:    2x2, 3x3
 * H-Lines:    1x2, 1x3, 1x4, 1x5
 * V-Lines:    2x1, 3x1, 4x1, 5x1
 * L-shapes:   l_0, l_90, l_180, l_270
 * Extended L: L_0, L_90, L_180, L_270
 * Mirror L:   rl_0, rl_90, rl_180, rl_270
 * T-shapes:   t_0, t_90, t_180, t_270
 * Z-shapes:   z_h, z_v
 * S-shapes:   s_h, s_v
 * Plus:       plus
 * ═══════════════════════════════════════════════════════════
 */
const GAME_LEVELS = [
  // ─── LEVEL 1 — Easy ───
  {
    levelID: 1,
    difficultyLabel: "Easy",
    targetScore: 500,
    allowedShapes: [
      '1x1', '1x2', '2x1', '2x2', 'l_0'
    ],
    gridPreset: []
  },

  // ─── LEVEL 2 — Easy ───
  {
    levelID: 2,
    difficultyLabel: "Easy",
    targetScore: 800,
    allowedShapes: [
      '1x1', '1x2', '1x3', '2x1', '3x1', '2x2',
      'l_0', 'l_90', 'l_180', 'l_270'
    ],
    gridPreset: [
      [0,0],[0,7],[7,0],[7,7]
    ]
  },

  // ─── LEVEL 3 — Medium ───
  {
    levelID: 3,
    difficultyLabel: "Medium",
    targetScore: 1200,
    allowedShapes: [
      '1x2','1x3','1x4','2x1','3x1','4x1','2x2',
      'l_0','l_90','l_180','l_270',
      'rl_0','rl_90','rl_180','rl_270',
      't_0','t_90'
    ],
    gridPreset: [
      [3,3],[3,4],[4,3],[4,4],
      [1,1],[1,6],[6,1],[6,6]
    ]
  },

  // ─── LEVEL 4 — Medium ───
  {
    levelID: 4,
    difficultyLabel: "Medium",
    targetScore: 1800,
    allowedShapes: [
      '1x2','1x3','1x4','1x5','2x1','3x1','4x1','5x1',
      '2x2','l_0','l_90','l_180','l_270',
      'L_0','L_90','L_180','L_270',
      't_0','t_90','t_180','t_270',
      'z_h','z_v','s_h','s_v'
    ],
    gridPreset: [
      [0,3],[1,4],[2,5],[3,6],[4,7],
      [7,4],[6,3],[5,2],[4,1],[3,0],
      [3,3],[4,4]
    ]
  },

  // ─── LEVEL 5 — Hard ───
  {
    levelID: 5,
    difficultyLabel: "Hard",
    targetScore: 2500,
    allowedShapes: [
      '1x3','1x4','1x5','3x1','4x1','5x1',
      '2x2','3x3',
      'l_0','l_90','l_180','l_270',
      'L_0','L_90','L_180','L_270',
      'rl_0','rl_90','rl_180','rl_270',
      't_0','t_90','t_180','t_270',
      'z_h','z_v','s_h','s_v',
      'plus'
    ],
    gridPreset: [
      [0,2],[0,5],[1,1],[1,3],[1,6],[2,0],[2,4],[2,7],
      [3,2],[3,5],[4,1],[4,4],[4,6],[5,0],[5,3],[5,7],
      [6,2],[6,5],[7,1],[7,4],[7,6]
    ]
  },

  // ─── LEVEL 6 — Hard (bonus) ───
  {
    levelID: 6,
    difficultyLabel: "Hard",
    targetScore: 3500,
    allowedShapes: [
      '1x4','1x5','4x1','5x1','3x3',
      'L_0','L_90','L_180','L_270',
      't_0','t_90','t_180','t_270',
      'z_h','z_v','s_h','s_v',
      'plus'
    ],
    gridPreset: [
      [0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],
      [7,0],[7,1],[7,2],[7,3],[7,4],[7,5],[7,6],[7,7],
      [1,0],[2,0],[3,0],[4,0],[5,0],[6,0],
      [1,7],[2,7],[3,7],[4,7],[5,7],[6,7],
      [3,3],[3,4],[4,3],[4,4]
    ]
  }
];
