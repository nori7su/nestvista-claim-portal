import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createThirdwebClient, getContract, sendAndConfirmTransaction } from "thirdweb";
import { mintTo } from "thirdweb/extensions/erc1155";
import { privateKeyToAccount } from "thirdweb/wallets";
import { polygon } from "thirdweb/chains";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY,
});

const adminAccount = privateKeyToAccount({
  client,
  privateKey: process.env.ADMIN_PRIVATE_KEY,
});

const contract = getContract({
  client,
  chain: polygon,
  address: process.env.CONTRACT_ADDRESS || "0xD6b986CFeEb0861113c233e5Eb17b62e4D7550FD",
});

app.post("/api/claim", async (req, res) => {
  const { address, passcode } = req.body;

  if (!address || !passcode) {
    return res.status(400).json({ success: false, message: "アドレスと合言葉を入力してください。" });
  }

  if (passcode !== process.env.CORRECT_PASSCODE) {
    return res.status(400).json({ success: false, message: "合言葉が正しくありません。" });
  }

  try {
    const transaction = mintTo({
      contract,
      to: address,
      nft: {
        tokenId: 0n,
      },
      supply: 1n,
    });

    await sendAndConfirmTransaction({
      transaction,
      account: adminAccount,
    });

    return res.json({ success: true, message: "NFTの受け取りが完了しました！" });
  } catch (error) {
    console.error("Mint error:", error);
    return res.status(500).json({ success: false, message: "ミント処理に失敗しました。" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
