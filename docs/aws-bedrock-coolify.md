# AWS Bedrock on Coolify

Kindred selects Bedrock through the existing provider interface. **Production
uses `AI_PROVIDER=bedrock`.** Private Ollama is retained only as a temporary,
approved rollback option, while ElevenLabs continues to provide speech-to-text
and text-to-speech.

## 1. Resolve the live model ID

Run this with the AWS identity that Kindred will use:

```bash
aws bedrock list-inference-profiles \
  --region "$AWS_REGION" \
  --query 'inferenceProfileSummaries[].[inferenceProfileId,inferenceProfileName]' \
  --output table
```

Choose the exact Claude inference-profile ID returned by AWS. Do not use the
short placeholder `anthropic.claude-sonnet-4-6`. Newer Claude models commonly
require a regional or global prefix such as `us.` or `global.`.

The S3 bucket can remain in `ca-west-1`; `AWS_REGION` here is specifically the
Bedrock Runtime source region and must support the selected profile.

## 2. Grant runtime permissions

Replace `<BEDROCK_REGION>` and `<AWS_ACCOUNT_ID>`, then attach this policy to
the IAM identity used by the Coolify service:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "InvokeKindredBedrockModels",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-*",
        "arn:aws:bedrock:<BEDROCK_REGION>:<AWS_ACCOUNT_ID>:inference-profile/*"
      ]
    }
  ]
}
```

For first-time access to a marketplace-backed model, an administrator may
need to enable it once in the Bedrock model catalog.

## 3. Configure Coolify

Set these server-only environment variables:

```dotenv
AI_PROVIDER=bedrock
AWS_REGION=<BEDROCK_REGION>
BEDROCK_MODEL_ID=<EXACT_INFERENCE_PROFILE_ID>
AI_REQUEST_TIMEOUT_MS=30000
```

If Coolify runs outside AWS, also set `AWS_ACCESS_KEY_ID` and
`AWS_SECRET_ACCESS_KEY` using a dedicated least-privilege IAM user. Add
`AWS_SESSION_TOKEN` when using temporary credentials. If Coolify runs on an
AWS instance with an attached role, omit all three credential variables.

## 4. Verify before production traffic

1. Build and deploy with `AI_PROVIDER=bedrock`.
2. Send a normal chat message and confirm a text response.
3. Ask about recent morning logs and confirm the tool loop completes.
4. Repeat for evening reports, body scans, habits, and medications.
5. Confirm crisis language is intercepted without a Bedrock request.
6. Keep the previous provider configuration available for rollback during the
   canary period.

Never test with real health information until region, logging, retention, and
guardrail requirements have been approved. Use synthetic records first.
