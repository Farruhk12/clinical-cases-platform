import serverless from "serverless-http";
import { createApiApp } from "../server/createApiApp";

export default serverless(createApiApp({ vercelPathRewrite: true }));
