import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createThirdwebClient, getContract, sendAndConfirmTransaction } from "thirdweb";
import { polygon } from "thirdweb/chains";
import { claimTo, mintTo } from "thirdweb/extensions/erc1155";
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

const CONTRACT_ADDRESS = "0xd6b986cfeeb0861113c233e5eb17b62e4d7550fd";

const contract = getContract({
  client,
  chain: polygon,
  address: CONTRACT_ADDRESS,
});

app.post("/api/claim", async (req, res) => {
  const { address, passcode } = req.body;

  if (passcode !== process.env.CORRECT_PASSCODE) {
    return res.status(400).json({ success: false, message: "合言葉が正しくありません。" });
  }

  try {
    const adminAccount = privateKeyToAccount({
      client,
      privateKey: process.env.ADMIN_PRIVATE_KEY,
    });

    const targetAddress = address.trim();

    let transaction;
    
    // まず claimTo を試し、失敗した場合は mintTo を使用
    try {
      transaction = claimTo({
        contract,
        to: targetAddress,
        tokenId: 0n,
        quantity: 1n,
      });
    } catch (e) {
      transaction = mintTo({
        contract,
        to: targetAddress,
        nft: {
          supply: 1n,
        },
      });
    }

    const receipt = await sendAndConfirmTransaction({
      transaction,
      account: adminAccount,
    });

    return res.json({ success: true, message: "NFTの受け取りが完了しました！", receipt });
  } catch (error) {
    console.error("Mint Detailed Error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "ミント処理に失敗しました。", 
      errorDetail: error.message || String(error)
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
