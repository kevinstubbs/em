import _ from 'lodash'
import Index from '../../src/@types/IndexType'
import Thought from '../../src/@types/Thought'
import ThoughtId from '../../src/@types/ThoughtId'
import ThoughtWithChildren from '../../src/@types/ThoughtWithChildren'
import Lexeme from '../../src/@types/Lexeme'
import keyValueBy from '../../src/util/keyValueBy.js'
import { createChildrenMapFromThoughts } from '../../src/util/createChildrenMap'

const SCHEMA_LATEST = 7

interface Database {
  schemaVersion?: number
}

interface Database6 extends Database {
  thoughtIndex: Index<Thought>
  lexemeIndex: Index<Lexeme>
  schemaVersion: 6
}

interface Database7 extends Database {
  thoughtIndex: Index<ThoughtWithChildren>
  lexemeIndex: Index<Lexeme>
  schemaVersion: 7
}

type DatabaseLatest = Database7

/** Migrates a database with an unknown schema to the latest schema. Exits with an error message if migration is not possible. */
const migrate = (db: Database): DatabaseLatest => {
  // missing schemaVersion property in db
  if (!db.schemaVersion) {
    console.error(`schemaVersion is not ${db.schemaVersion}. No migration is possible.`)
    process.exit(1)
  }
  // higher than expected
  else if (db.schemaVersion > SCHEMA_LATEST) {
    console.error(
      `schemaVersion v${db.schemaVersion} is higher than the migration script's SCHEMA_LATEST v${SCHEMA_LATEST}. Add migrateVersion[${SCHEMA_LATEST}].`,
    )
    process.exit(1)
  }
  // no migration needed for SCHEMA_LATEST
  else if (db.schemaVersion === SCHEMA_LATEST) return db as DatabaseLatest
  // missing migration
  else if (!migrateVersion[db.schemaVersion]) {
    console.error(`Latest schema version is v${SCHEMA_LATEST}. No migration available from schema v${db.schemaVersion}`)
    process.exit(1)
  }

  // otherwise migrate one step and recurse
  return migrate(migrateVersion[db.schemaVersion](db as Database6))
}

/** A Record of migration functions. Each migrates a single version step, e.g. 6 -> 7. */
// TODO: Why can't we type db as Database here?
const migrateVersion: Record<number, (db: any) => Database> = {
  '6': (db6: Database6): Database7 => {
    const db7: Database7 = {
      thoughtIndex: {},
      lexemeIndex: {},
      schemaVersion: 7,
    }
    Object.values(db6.thoughtIndex).forEach(thought => {
      const children = Object.values(thought.childrenMap || {}).map(id => db6.thoughtIndex[id])
      db7.thoughtIndex[thought.id] = {
        ..._.omit(thought, 'childrenMap'),
        children: keyValueBy(children, (child: Thought) => ({
          [child.id]: child,
        })),
      }
    })

    return db7
  },
}

export default migrate
