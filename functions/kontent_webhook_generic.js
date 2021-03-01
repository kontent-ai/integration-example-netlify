const KontentDelivery = require('@kentico/kontent-delivery');
const KontentHelper = require('@kentico/kontent-webhook-helper');

const CONFIG_DELIMITER = ",";

exports.handler = async (event, context) => {

  // Only receiving POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Consistency check - make sure your netlify enrionment variable and your webhook secret matches
  if (!KontentHelper.signatureHelper.isValidSignatureFromString(event.body, process.env.KONTENT_SECRET, event.headers['x-kc-signature'])) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  const jsonBody = JSON.parse(event.body);
  const webhookMessage = jsonBody.message;
  const webhookData = jsonBody.data;

  // extracting projectId, operation & type from a webhook message
  const projectId = webhookMessage.project_id;
  const operation = webhookMessage.operation;
  const type = webhookMessage.type;

  let response = [];

  // loading allowed operations and types from config
  let allowedOperations = process.env.ALLOWED_OPERATIONS.split(CONFIG_DELIMITER);
  let allowedTypes = process.env.ALLOWED_TYPES.split(CONFIG_DELIMITER);

  // if the method & type is allowed, download the whole affected content items
  if (projectId && allowedOperations.includes(operation) && allowedTypes.includes(type)) {
    const deliveryClient = new KontentDelivery.DeliveryClient({ projectId: projectId });
    for (let i = 0, affectedItem; affectedItem = webhookData.items[i]; i++) {
      const contentItem = await deliveryClient.item(affectedItem.codename).languageParameter(affectedItem.language).toPromise();
      if (contentItem) response.push(contentItem);
    }
  }

  // print the affected content items into function log
  console.log(JSON.stringify(response));

  return {
    statusCode: 200,
    body: `${JSON.stringify(response)}`,
  };
};
