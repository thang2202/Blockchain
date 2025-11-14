import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { create } from 'ipfs-http-client';
import { ethers } from 'ethers';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }
));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/art-auction')
  .then(() => console.log('✅ Kết nối đến MongoDB'))
  .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// Kết nối IPFS
const ipfs = create({ 
  host: process.env.IPFS_HOST || 'localhost', 
  port: process.env.IPFS_PORT || 5001, 
  protocol: 'http' 
});

// Multer cho upload file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Schemas MongoDB
const nftMetadataSchema = new mongoose.Schema({
  tokenId: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String },
  image: { type: String, required: true },
  imageIpfsHash: { type: String },
  metadataIpfsHash: { type: String },
  artist: { type: String, required: true },
  artistAddress: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const auctionSchema = new mongoose.Schema({
  auctionId: { type: Number, required: true, unique: true },
  tokenId: { type: Number, required: true },
  seller: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  startPrice: { type: String, required: true },
  highestBidder: { type: String, default: null },
  highestBid: { type: String, default: "0" },
  ended: { type: Boolean, default: false },
  bids: [{
    bidder: String,
    amount: String,
    timestamp: { type: Date, default: Date.now }
  }]
});

const NFTMetadata = mongoose.model('NFTMetadata', nftMetadataSchema);
const Auction = mongoose.model('Auction', auctionSchema);

// Kết nối Ethereum
const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL || 'http://localhost:8545');
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', provider);

// ABI Contracts
const AUCTION_ABI = [
  "event AuctionCreated(uint256 indexed auctionId, uint256 indexed tokenId, address seller, uint256 startPrice, uint256 endTime)",
  "event NewBid(uint256 indexed auctionId, address bidder, uint256 amount)",
  "event AuctionEnded(uint256 indexed auctionId, address winner, uint256 amount)"
];

let auctionContract;

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    services: {
      mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
      ipfs: ipfs ? 'Connected' : 'Disconnected',
      blockchain: provider ? 'Connected' : 'Disconnected'
    }
  });
});

// Upload artwork và tạo metadata
app.post('/api/upload-artwork', upload.single('image'), async (req, res) => {
  try {
    console.log('📨 Nhận request upload artwork...');
    console.log('📝 Body:', req.body);
    console.log('📁 File:', req.file);

    const { name, description, artist, artistAddress } = req.body;
    
    if (!req.file) {
      console.log('❌ Không có file được upload');
      return res.status(400).json({ error: 'Không có tệp hình ảnh nào được cung cấp' });
    }

    // Kiểm tra kết nối IPFS
    try {
      const ipfsVersion = await ipfs.version();
      console.log('✅ IPFS connected:', ipfsVersion);
    } catch (ipfsError) {
      console.error('❌ IPFS connection failed:', ipfsError);
      return res.status(500).json({ 
        error: 'IPFS không kết nối được', 
        details: 'Hãy chắc chắn rằng IPFS daemon đang chạy: ipfs daemon'
      });
    }

    console.log('📤 Đang tải tác phẩm lên IPFS...');

    // Đọc file từ disk thay vì sử dụng buffer
    const fs = await import('fs');
    const imagePath = req.file.path;
    
    // Đọc file dưới dạng buffer
    const imageBuffer = fs.readFileSync(imagePath);
    console.log('📊 Kích thước file:', imageBuffer.length, 'bytes');
    
    // Upload image to IPFS
    const imageResult = await ipfs.add(imageBuffer);
    const imageIpfsHash = imageResult.cid.toString();
    console.log('🖼️ Image IPFS Hash:', imageIpfsHash);

    // Create metadata
    const metadata = {
      name: name || 'Tác phẩm vô danh',
      description: description || 'Không có mô tả',
      image: `ipfs://${imageIpfsHash}`,
      artist: artist || 'Nghệ sĩ vô danh',
      artistAddress: artistAddress || '0x0000000000000000000000000000000000000000',
      createdAt: new Date().toISOString(),
      attributes: []
    };

    // Upload metadata to IPFS
    const metadataResult = await ipfs.add(JSON.stringify(metadata));
    const metadataIpfsHash = metadataResult.cid.toString();
    console.log('📋 Metadata IPFS Hash:', metadataIpfsHash);

    // Xóa file tạm sau khi upload
    fs.unlinkSync(imagePath);
    console.log('🗑️ Đã xóa file tạm');

    console.log('✅ Đã tải tác phẩm nghệ thuật lên thành công');

    res.json({
      success: true,
      imageIpfsHash,
      metadataIpfsHash,
      metadata: {
        ...metadata,
        image: `https://ipfs.io/ipfs/${imageIpfsHash}`
      }
    });

  } catch (error) {
    console.error('❌ Lỗi tải lên:', error);
    
    // Xóa file tạm nếu có lỗi
    if (req.file && req.file.path) {
      try {
        const fs = await import('fs');
        fs.unlinkSync(req.file.path);
      } catch (deleteError) {
        console.error('❌ Lỗi xóa file tạm:', deleteError);
      }
    }
    
    res.status(500).json({ 
      error: 'Lỗi tải lên tác phẩm nghệ thuật', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Lưu NFT metadata
app.post('/api/nft-metadata', async (req, res) => {
  try {
    const { tokenId, name, description, image, imageIpfsHash, metadataIpfsHash, artist, artistAddress } = req.body;
    
    const nftMetadata = new NFTMetadata({
      tokenId,
      name,
      description,
      image,
      imageIpfsHash,
      metadataIpfsHash,
      artist,
      artistAddress
    });

    await nftMetadata.save();
    
    console.log(`✅ Đã lưu NFT metadata cho token ${tokenId}`);
    
    res.json({ success: true, metadata: nftMetadata });
  } catch (error) {
    console.error('❌ Lỗi lưu siêu dữ liệu:', error);
    res.status(500).json({ error: 'Lưu siêu dữ liệu thất bại', details: error.message });
  }
});

// Lấy danh sách NFT
app.get('/api/nfts', async (req, res) => {
  try {
    const nfts = await NFTMetadata.find().sort({ createdAt: -1 });
    res.json(nfts);
  } catch (error) {
    console.error('❌ Lỗi lấy NFTs:', error);
    res.status(500).json({ error: 'Tải NFTs thất bại' });
  }
});

// Lấy danh sách auction đang hoạt động
app.get('/api/active-auctions', async (req, res) => {
  try {
    const auctions = await Auction.find({ 
      ended: false,
      endTime: { $gt: new Date() }
    }).sort({ startTime: -1 });
    
    // Populate với thông tin NFT
    const populatedAuctions = await Promise.all(
      auctions.map(async (auction) => {
        const nft = await NFTMetadata.findOne({ tokenId: auction.tokenId });
        return {
          ...auction.toObject(),
          nftMetadata: nft
        };
      })
    );
    
    res.json(populatedAuctions);
  } catch (error) {
    console.error('❌ Lỗi lấy đấu giá:', error);
    res.status(500).json({ error: 'Tải đấu giá thất bại' });
  }
});

// Lấy chi tiết auction
app.get('/api/auction/:auctionId', async (req, res) => {
  try {
    const auction = await Auction.findOne({ 
      auctionId: req.params.auctionId 
    });
    
    if (!auction) {
      return res.status(404).json({ error: 'Không tìm thấy đấu giá' });
    }
    
    const nft = await NFTMetadata.findOne({ tokenId: auction.tokenId });
    
    res.json({
      ...auction.toObject(),
      nftMetadata: nft
    });
  } catch (error) {
    console.error('❌ Lỗi lấy đấu giá:', error);
    res.status(500).json({ error: 'Tải đấu giá thất bại' });
  }
});

// Lắng nghe sự kiện từ Smart Contract
async function setupEventListeners() {
  try {
    if (!process.env.AUCTION_CONTRACT_ADDRESS) {
      console.log('⚠️  Địa chỉ hợp đồng đấu giá chưa được thiết lập, bỏ qua việc lắng nghe sự kiện');
      return;
    }

    auctionContract = new ethers.Contract(
      process.env.AUCTION_CONTRACT_ADDRESS,
      AUCTION_ABI,
      provider
    );

    // Lắng nghe sự kiện tạo auction
    auctionContract.on('AuctionCreated', async (auctionId, tokenId, seller, startPrice, endTime) => {
      try {
        console.log(`🎯 Đấu giá mới được tạo: ${auctionId} cho token ${tokenId}`);
        
        const auction = new Auction({
          auctionId: Number(auctionId),
          tokenId: Number(tokenId),
          seller,
          startTime: new Date(Number(startPrice) * 1000),
          endTime: new Date(Number(endTime) * 1000),
          startPrice: startPrice.toString()
        });
        
        await auction.save();
        console.log(`✅ Đấu giá ${auctionId} đã được lưu vào cơ sở dữ liệu`);
      } catch (error) {
        console.error('❌ Lỗi xử lý sự kiện AuctionCreated:', error);
      }
    });

    // Lắng nghe sự kiện đặt giá
    auctionContract.on('NewBid', async (auctionId, bidder, amount) => {
      try {
        await Auction.findOneAndUpdate(
          { auctionId: Number(auctionId) },
          { 
            $set: { 
              highestBidder: bidder,
              highestBid: amount.toString()
            },
            $push: {
              bids: {
                bidder,
                amount: amount.toString(),
                timestamp: new Date()
              }
            }
          }
        );
        console.log(`💰 Giá mới trong phiên đấu giá ${auctionId}: ${bidder} - ${ethers.formatEther(amount)} ETH`);
      } catch (error) {
        console.error('❌ Lỗi xử lý sự kiện NewBid:', error);
      }
    });

    // Lắng nghe sự kiện kết thúc auction
    auctionContract.on('AuctionEnded', async (auctionId, winner, amount) => {
      try {
        await Auction.findOneAndUpdate(
          { auctionId: Number(auctionId) },
          { 
            ended: true,
            highestBidder: winner,
            highestBid: amount.toString()
          }
        );
        console.log(`🏁 Đấu giá ${auctionId} kết thúc. Người thắng: ${winner} với ${ethers.formatEther(amount)} ETH`);
      } catch (error) {
        console.error('❌ Lỗi xử lý sự kiện AuctionEnded:', error);
      }
    });

    console.log('✅ Việc thiết lập lắng nghe sự kiện đã hoàn thành');
  } catch (error) {
    console.error('❌ Lỗi thiết lập lắng nghe sự kiện:', error);
  }
}

app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!' });
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy trên cổng ${PORT}`);
  console.log(`📊 Kiểm tra sức khỏe: http://localhost:${PORT}/api/health`);
  setupEventListeners();
});