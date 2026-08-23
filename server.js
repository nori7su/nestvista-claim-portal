import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createThirdwebClient, getContract, prepareContractCall, sendTransaction } from "thirdweb";
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

    // 0x0000000000000000000000000000000000000000 (NATIVE TOKEN)
    const NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";

    // Edition Drop / DropERC1155 の標準 claim 関数を直接実行
    const transaction = prepareContractCall({
      contract,
      method: {
        name: "claim",
        type: "function",
        inputs: [
          { name: "_receiver", type: "address" },
          { name: "_tokenId", type: "uint256" },
          { name: "_quantity", type: "uint256" },
          { name: "_currency", type: "address" },
          { name: "_pricePerToken", type: "uint256" },
          {
            name: "_allowlistProof",
            type: "tuple",
            components: [
              { name: "proof", type: "bytes32[]" },
              { name: "quantityLimitPerWallet", type: "uint256" },
              { name: "pricePerToken", type: "uint256" },
              { name: "currency", type: "address" },
            ],
          },
          { name: "_data", type: "bytes" },
        ],
        outputs: [],
        stateMutability: "payable",
      },
      params: [
        targetAddress,
        0n, // Token ID
        1n, // Quantity
        NATIVE_TOKEN,
        0n, // Price per token
        {
          proof: [],
          quantityLimitPerWallet: 0n,
          pricePerToken: 0n,
          currency: NATIVE_TOKEN,
        },
        "0x",
      ],
    });

    const receipt = await sendTransaction({
      transaction,
      account: adminAccount,
    });

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
