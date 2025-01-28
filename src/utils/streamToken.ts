import { StreamClient } from "@stream-io/node-sdk";

export async function generateStreamToken(
  userId: string,
  name: string,
  image?: string
): Promise<string> {
  const apiKey = process.env.STREAM_API_KEY;
  const apiSecret = process.env.STREAM_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("Stream API credentials not configured");
  }

  const client = new StreamClient(apiKey, apiSecret);

  // Create user if it doesn't exist
  await client.upsertUsers([
    {
      id: userId,
      role: "user",
      name,
      image: image || `https://getstream.io/random_svg/?name=${name}`,
    },
  ]);

  // Generate token with 24 hour validity
  const token = client.generateUserToken({
    user_id: userId,
    validity_in_seconds: 24 * 60 * 60,
  });

  return token;
}
