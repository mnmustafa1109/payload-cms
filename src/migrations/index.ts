import * as migration_20251121_151414 from './20251121_151414';
import * as migration_20260114_155740 from './20260114_155740';
import * as migration_20260114_184323 from './20260114_184323';
import * as migration_20260115_201551 from './20260115_201551';
import * as migration_20260116_141632 from './20260116_141632';
import * as migration_20260116_145405 from './20260116_145405';

export const migrations = [
  {
    up: migration_20251121_151414.up,
    down: migration_20251121_151414.down,
    name: '20251121_151414',
  },
  {
    up: migration_20260114_155740.up,
    down: migration_20260114_155740.down,
    name: '20260114_155740',
  },
  {
    up: migration_20260114_184323.up,
    down: migration_20260114_184323.down,
    name: '20260114_184323',
  },
  {
    up: migration_20260115_201551.up,
    down: migration_20260115_201551.down,
    name: '20260115_201551',
  },
  {
    up: migration_20260116_141632.up,
    down: migration_20260116_141632.down,
    name: '20260116_141632',
  },
  {
    up: migration_20260116_145405.up,
    down: migration_20260116_145405.down,
    name: '20260116_145405'
  },
];
