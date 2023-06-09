import { DeliveryClient } from "@kontent-ai/delivery-sdk";
import { signatureHelper } from "@kontent-ai/webhook-helper";
import {
  IWebhookDeliveryData,
  IWebhookResponse,
} from "@kontent-ai/webhook-helper/dist/cjs/models/webhook-models.class.ts";
import { Handler } from "@netlify/functions";

import packageJson from "../package.json";

const CONFIG_DELIMITER = ",";

export const handler: Handler = async (event) => {
  // Only receiving POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  if (!event.body) {
    return { statusCode: 400, body: "Missing body" };
  }

  // Consistency check - make sure your netlify environment variable and your webhook secret matches
  if (
    !signatureHelper.isValidSignatureFromString(
      event.body,
      process.env.KONTENT_SECRET ?? "",
      event.headers["x-kc-signature"] ?? "",
    )
  ) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  const jsonBody: IWebhookResponse<IWebhookDeliveryData> = JSON.parse(event.body);
  const webhookMessage = jsonBody.message;
  const webhookData = jsonBody.data;

  // extracting projectId, operation & type from a webhook message
  const projectId = webhookMessage.project_id;
  const operation = webhookMessage.operation;
  const type = webhookMessage.type;

  // loading allowed operations and types from config
  const allowedOperations = process.env.ALLOWED_OPERATIONS?.split(CONFIG_DELIMITER) ?? [];
  const allowedTypes = process.env.ALLOWED_TYPES?.split(CONFIG_DELIMITER) ?? [];

  // if the method or type is not allowed abort
  if (projectId && allowedOperations.includes(operation) && allowedTypes.includes(type)) {
    return { statusCode: 200, body: "[]" };
  }

  // download the affected items
  const deliveryClient = new DeliveryClient({
    projectId,
    globalHeaders: () => [{ header: "X-KC-SOURCE", value: `${packageJson.name};${packageJson.version}` }],
  });
  const response = await Promise.all(
    webhookData.items.map(item => deliveryClient.item(item.codename).languageParameter(item.language).toPromise()),
  );

  // print the affected content items into function log
  console.log(JSON.stringify(response));

  return {
    statusCode: 200,
    body: `${JSON.stringify(response)}`,
  };
};
