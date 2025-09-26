const { execSync } = require("child_process");

function commitAndPush(msg) {
  try {
    execSync("git add .", { cwd: "../../coffee-dashboard", stdio: "inherit" });
    execSync(`git commit -m "${msg}"`, { cwd: "../../coffee-dashboard", stdio: "inherit" });
    execSync("git push origin main", { cwd: "../../coffee-dashboard", stdio: "inherit" });
    console.log("✅ Changes committed & pushed to GitHub");
  } catch (err) {
    console.error("❌ Git push failed", err.message);
  }
}

module.exports = { commitAndPush };
