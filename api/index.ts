/**
 * Vercel вызывает обработчик как Node (req, res), не как Lambda event.
 * serverless-http здесь ломает рантайм (FUNCTION_INVOCATION_FAILED).
 */
import { createApiApp } from "../server/createApiApp";

export default createApiApp({ vercelPathRewrite: true });
