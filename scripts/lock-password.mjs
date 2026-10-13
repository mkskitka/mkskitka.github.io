// Prints the `lock` value for a project password:
//   node scripts/lock-password.mjs "the password"
// Paste the output into the project's entry in src/data/projects.js as  lock: '...'
import { sha256 } from '../src/lib/sha256.js'

const password = process.argv[2]
if (!password) {
  console.error('Usage: node scripts/lock-password.mjs "the password"')
  process.exit(1)
}
console.log(sha256(password))
