import * as migration_20251121_151414 from './20251121_151414';
import * as migration_20260114_155740 from './20260114_155740';

export const migrations = [
  {
    up: migration_20251121_151414.up,
    down: migration_20251121_151414.down,
    name: '20251121_151414',
  },
  {
    up: migration_20260114_155740.up,
    down: migration_20260114_155740.down,
    name: '20260114_155740'
  },
];
