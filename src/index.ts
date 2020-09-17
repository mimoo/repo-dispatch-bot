import { Application, Context } from 'probot';
import child_process from 'child_process';
import { promises as fs } from 'fs';
import { promisify } from 'util';
import tmp from 'tmp-promise';
import { Octokit } from '@octokit/rest';

const exec = promisify(child_process.exec);

async function handle_pr(context: Context) {
  // helpers
  context.log("handling PR");
  const pr_number = context.payload.pull_request.number;
  const head_sha = context.payload.pull_request.head.sha;

  // github api lies about base sha, so we pull it from the first commit's parent
  const commits = await context.github.pullRequests.listCommits(context.repo({ number: pr_number }));
  const base_sha = commits.data[0].parents[0].sha;

  // send a repo dispatch to calibra/mirai-bot in order to run MIRAI on the PR
  const octokit = new Octokit({
    auth: process.env.MIRAI_BOT,
    userAgent: "repo-dispatch-bot"
  });
  await octokit.repos.createDispatchEvent({
    "owner": "mimoo",
    "repo": "mirai-bot",
    "event_type": "new_PR",
    "client_payload": context.repo({
      "sender": context.payload.pull_request.sender,
      "action": context.payload.pull_request.action,
      "pull_id": pr_number,
      "pull_ref": head_sha,
      "base_ref": base_sha
    })
  });
}

export = (app: Application) => {
  app.on('pull_request.opened', async (context: Context) => {
    context.log("pull request opened");
    await handle_pr(context);
  });

  app.on('pull_request.synchronize', async (context: Context) => {
    context.log("pull request synchronize");
    await handle_pr(context);
  });

  // DELETE THIS
  app.on('pull_request.reopened', async (context: Context) => {
    context.log("pull request reopened");
    await handle_pr(context);
  });
}
