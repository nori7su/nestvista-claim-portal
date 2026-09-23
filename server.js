import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createThirdwebClient, getContract, sendAndConfirmTransaction, prepareContractCall, readContract } from "thirdweb";
import { polygon } from "thirdweb/chains";
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

const CONTRACT_ADDRESS = "0xd6b9e57cf1e9052976b9f56d0b9cc677a0fd50fd";

const contract = getContract({
  client,
  chain: polygon,
  address: CONTRACT_ADDRESS,
});

// オンチェーンから保有数を安全に取得（エラー時は0nとして扱う）
async function getUserBalance(targetAddress) {
  try {
    const balance = await readContract({
      contract,
      method: "function balanceOf(address account, uint256 id) view returns (uint256)",
      params: [targetAddress, 0n],
    });
    return BigInt(balance);
  } catch (e) {
    return 0n;
  }
}

// 受け取り済みチェックAPI
app.get("/api/check-status", async (req, res) => {
  const { address } = req.query;

  if (!address || typeof address !== "string") {
    return res.status(400).json({ claimed: false, message: "アドレスが指定されていません。" });
  }

  try {
    const targetAddress = address.trim();
    const balance = await getUserBalance(targetAddress);
    return res.json({ claimed: balance > 0n, balance: balance.toString() });
  } catch (error) {
    return res.json({ claimed: false, balance: "0" });
  }
});

app.post("/api/claim", async (req, res) => {
  const { address, passcode } = req.body;

  if (passcode !== process.env.CORRECT_PASSCODE) {
    return res.status(400).json({ success: false, message: "合言葉が正しくありません。" });
  }

  try {
    const targetAddress = address.trim();

    // 重複ミント防止：すでに持っているか確認
    const balance = await getUserBalance(targetAddress);
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

    // Claim condition 検証をバイパスし、管理者権限で直接ミント関数を呼び出す
    const transaction = prepareContractCall({
      contract,
      method: "function claim(address _receiver, uint256 _tokenId, uint256 _quantity, address _currency, uint256 _pricePerToken, (bytes32[] allowlistProof, uint256 maxClaimable, uint256 pricePerToken, address currency) _allowlistProof, bytes _data)",
      params: [
        targetAddress, // _receiver
        0n,            // _tokenId
        1n,            // _quantity
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // NATIVE_TOKEN
        0n,            // _pricePerToken
        [[], 0n, 0n, "0x0000000000000000000000000000000000000000"], // _allowlistProof
        "0x"           // _data
      ],
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
