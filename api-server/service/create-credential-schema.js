const uuidv4 = require("uuid/v4");
const CONSTANTS = require("../config/constants");

const createCredentialSchema = async (req, res) => {
  let results = {};
  try {
    let ledger = req.app.get("ledger");
    let applicationData = req.app.get("applicationData");

    const credentialSchema = req.body.credentialSchema;
    const requestorID = req.body.requestorID;
    const requestor = applicationData[requestorID];

    let attributes = [];
    credentialSchema.attributes.forEach((attribute) => {
      attributes.push(attribute);
    });

    let [schemaID, schema] = await ledger.issuerCreateSchema(
      requestor.did,
      credentialSchema.name,
      credentialSchema.versionID,
      attributes);

    console.log(`Created credential schema ${requestorID} ${credentialSchema.name} ${credentialSchema.versionID}`);

    let schemas = (requestor["credentialSchemas"]) ?
      requestor["credentialSchemas"] : [];

    schemas.push({
      "id": schemaID,
      "schema": schema
    });

    let schemaRequest = await ledger.buildSchemaRequest(requestor.did, schema);
    console.log("Built schema request");

    await ledger.signAndSubmitRequest(
      applicationData.poolHandle,
      requestor.wallet,
      requestor.did,
      schemaRequest);
    console.log("Signed and submitted schema request");

    requestor["credentialSchemas"] = schemas;

    let getSchemaRequest = await ledger.buildGetSchemaRequest(requestor.did, schemaID);
    let getSchemaResponse = await ledger.submitRequest(applicationData.poolHandle, getSchemaRequest);
    let [getSchemaId, getSchema] = await ledger.parseGetSchemaResponse(getSchemaResponse);
    console.log(["Got schema response", getSchema]);

    let [credDefID, credDefJson] =
      await ledger.issuerCreateAndStoreCredentialDef(
        requestor.wallet,
        requestor.did,
        getSchema, "tag", "CL", "{\"support_revocation\": false}");

    let credDefRequest = await ledger.buildCredDefRequest(requestor.did, credDefJson);
    console.log("Built credential definition request");

    await ledger.signAndSubmitRequest(
      applicationData.poolHandle,
      requestor.wallet,
      requestor.did,
      credDefRequest);
    console.log("Signed and submitted credential definition request");

    // TODO: Save to db
    applicationData[requestor.uid] = requestor;
    results = requestor;

    res.status(200);
  } catch (e) {
    if (e.message !== "WalletAlreadyExistsError") {
      console.log(e);
      results = {
        "message": "Failed to create credential schema."
      };
      res.status(500);
    }
  }

  res.append("Content-Type", "application/json");
  res.send(results);
};

module.exports = createCredentialSchema;