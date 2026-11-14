// Runs the repository and project setup in turn, passing the flags (--dry-run) to both.
const args = Bun.argv.slice(2);
for (const script of ["setup-repo.ts", "setup-project.ts"]) {
  const proc = Bun.spawn(["bun", `${import.meta.dir}/${script}`, ...args], {
    stdio: ["inherit", "inherit", "inherit"],
  });
  if ((await proc.exited) !== 0) process.exit(1);
}
