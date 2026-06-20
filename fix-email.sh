#!/bin/bash
node -e '
const fs = require("fs");
const file = process.env.HOME + "/.config/opencode/antigravity-accounts.json";
const data = JSON.parse(fs.readFileSync(file));
data.accounts.forEach(a => {
  if (a.projectId === "kinetic-temple-n4p95") {
    a.email = "yapfrandb@gmail.com";
  }
});
fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log("Successfully fixed the email label for yapfrandb@gmail.com!");
'
