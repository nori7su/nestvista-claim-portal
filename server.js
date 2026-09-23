import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createThirdwebClient, getContract, sendAndConfirmTransaction } from "thirdweb";
import { polygon } from "thirdweb/chains";
import { claimTo, balanceOf } from "thirdweb/extensions/erc1155";
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

// 受け取り済みかどうかを事前チェックするAPI
app.get("/api/check-status", async (req, res) => {
  const { address } = req.query;

  if (!address || typeof address !== "string") {
    return res.status(400).json({ claimed: false, message: "アドレスが指定されていません。" });
  }

  try {
    const targetAddress = address.trim();
    const balance = await balanceOf({
      contract,
      owner: targetAddress,
      tokenId: 0n,
    });

    const claimed = balance > 0n;
    return res.json({ claimed, balance: balance.toString() });
  } catch (error) {
    console.error("Check Status Error:", error);
    return res.status(500).json({ claimed: false, message: "状態の確認に失敗しました。" });
  }
});

app.post("/api/claim", async (req, res) => {
  const { address, passcode } = req.body;

  if (passcode !== process.env.CORRECT_PASSCODE) {
    return res.status(400).json({ success: false, message: "合言葉が正しくありません。" });
  }

  try {
    const targetAddress = address.trim();

    // 重複ミント防止：すでに1枚以上所有しているかオンチェーンで確認
    const balance = await balanceOf({
      contract,
      owner: targetAddress,
      tokenId: 0n,
    });

    if (balance > 0n) {
      return res.status(400).json({
        success: false,
        claimed: true,
        message: "このウォレットアドレスはすでにNFTを受け取り済みです。",
      });
    }

    const adminAccount = privateKeyToAccount({
      client,
      privateKey: process.env.ADMIN_PRIVATE_KEY,
    });

    // claimTo トランザクション生成
    const transaction = claimTo({
      contract,
      to: targetAddress,
      tokenId: 0n,
      quantity: 1n,
    });

    const receipt = await sendAndConfirmTransaction({
      transaction,
      account: adminAccount,
    });

    return res.json({ 
      success: true, 
      message: "NFTの受け取りが完了しました！", 
      transactionHash: receipt.transactionHash 
    });
  } catch (error) {
    console.error("Claim Detailed Error:", error);
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
