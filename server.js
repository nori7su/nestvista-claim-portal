import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createThirdwebClient, getContract } from "thirdweb";
import { getAddress } from "thirdweb/utils";
import { polygon } from "thirdweb/chains";
import { mintTo } from "thirdweb/extensions/erc1155";
import { privateKeyToAccount } from "thirdweb/wallets";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY,
});

// getAddress を使用してアドレスの形式・チェックサムを強制変換
const rawAddress = "0xD6b986CFeEb0861113c233e5Eb17b62e4D7550FD".trim();
const contractAddress = getAddress(rawAddress);

const contract = getContract({
  client,
  chain: polygon,
  address: contractAddress,
});

app.post("/api/claim", async (req, res) => {
  const { address, passcode } = req.body;

  if (passcode !== process.env.CORRECT_PASSCODE) {
    return res.status(400).json({ success: false, message: "合言葉が正しくありません。" });
  }

  try {
    const cleanUserAddress = getAddress(address.trim());

    const adminAccount = privateKeyToAccount({
      client,
      privateKey: process.env.ADMIN_PRIVATE_KEY,
    });

    const transaction = mintTo({
      contract,
      to: cleanUserAddress,
      tokenId: 0n,
      quantity: 1n,
    });

    const receipt = await transaction.send({ account: adminAccount });
    return res.json({ success: true, message: "NFTの受け取りが完了しました！", receipt });
  } catch (error) {
    console.error("Mint Error:", error);
    return res.status(500).json({ success: false, message: "ミント処理に失敗しました。" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
