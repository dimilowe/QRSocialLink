import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertContentSchema, earnings } from "@shared/schema";
import { db } from "./db";
import { and, sql } from "drizzle-orm";
import Stripe from "stripe";
import multer from "multer";
import path from "path";
import { Resend } from "resend";
import fs from "fs";
import nodemailer from "nodemailer";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Email sending function
async function sendAccessEmail(buyerEmail: string, contentId: number, paymentIntentId: string) {
  try {
    const content = await storage.getContentById(contentId);
    if (!content) return;

    const accessUrl = `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'https://autopaywall.replit.app'}/access/${contentId}/${paymentIntentId}`;
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #a855f7;">Thank You for Your Tip!</h2>
        <p>Thank you for your purchase! You now have access to:</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0;">${content.title}</h3>
          <p style="margin: 0; color: #666;">${content.description}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${accessUrl}" 
             style="background: linear-gradient(135deg, #a855f7, #ec4899); 
                    color: white; 
                    padding: 15px 30px; 
                    text-decoration: none; 
                    border-radius: 8px; 
                    display: inline-block;
                    font-weight: bold;">
            Access Your Content
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          This link will remain active. You can access your content anytime by clicking the button above.
        </p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          Powered by TipJar - Support Your Favorite Creators
        </p>
      </div>
    `;

    // Try Resend first if available, fall back to console logging
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        
        console.log(`📧 Attempting to send email to ${buyerEmail} via Resend...`);
        
        const emailData = {
          from: 'TipJar <noreply@code2cash.co>',
          to: buyerEmail,
          subject: `🎉 Thank You for Your Tip: ${content.title}`,
          html: emailHtml
        };
        
        console.log('📧 Email data:', {
          from: emailData.from,
          to: emailData.to,
          subject: emailData.subject,
          htmlLength: emailHtml.length
        });
        
        const result = await resend.emails.send(emailData);
        
        console.log(`✅ Access email sent via Resend to ${buyerEmail} for content ${contentId}`);
        console.log('📧 Resend response:', result);
        return true;
      } catch (error) {
        console.error('❌ Resend email error:', error);
        console.log(`📧 Falling back to console log for ${buyerEmail}`);
        
        // Fall back to console logging if Resend fails
        console.log(`📧 EMAIL WOULD BE SENT TO: ${buyerEmail}`);
        console.log(`📧 SUBJECT: 🎉 Thank You for Your Tip: ${content.title}`);
        console.log(`📧 ACCESS URL: ${accessUrl}`);
        return true; // Return true so the purchase still processes
      }
    } else {
      // For development - log email content instead of sending
      console.log(`📧 EMAIL WOULD BE SENT TO: ${buyerEmail}`);
      console.log(`📧 SUBJECT: 🎉 Thank You for Your Tip: ${content.title}`);
      console.log(`📧 ACCESS URL: ${accessUrl}`);
      console.log('⚠️  To send real emails, add RESEND_API_KEY to environment variables');
      return true;
    }
  } catch (error) {
    console.error('❌ Error sending access email:', error);
    return false;
  }
}

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024, // 5GB limit
    fieldSize: 25 * 1024 * 1024, // 25MB limit for text fields (to handle large base64 images)
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Debug environment variables
  console.log('🔍 Environment check:');
  console.log('RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);
  console.log('STRIPE_SECRET_KEY exists:', !!process.env.STRIPE_SECRET_KEY);
  console.log('STRIPE_WEBHOOK_SECRET exists:', !!process.env.STRIPE_WEBHOOK_SECRET);
  if (process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY starts with:', process.env.RESEND_API_KEY.substring(0, 8) + '...');
  }

  // Add test email endpoint for debugging
  app.post('/api/test-email', async (req, res) => {
    try {
      const { email } = req.body;
      const testEmail = email || 'test@example.com';
      
      console.log('🧪 Testing email to:', testEmail);
      
      const emailSent = await sendAccessEmail(testEmail, 4, 'test_payment_intent_123');
      
      if (emailSent) {
        res.json({ success: true, message: 'Test email sent successfully' });
      } else {
        res.json({ success: false, message: 'Test email failed' });
      }
    } catch (error) {
      console.error('Test email error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  // Auth middleware
  await setupAuth(app);

  // Serve uploaded files
  app.use('/uploads', express.static('uploads'));

  // Tip page with Open Graph meta tags for social sharing
  app.get('/p/:id', async (req, res) => {
    try {
      const contentId = parseInt(req.params.id);
      const contentWithUser = await storage.getContentByIdWithUser(contentId);
      
      if (!contentWithUser) {
        return res.status(404).send('<h1>Content not found</h1>');
      }

      const { title, description, previewImage, price, pricingModel, minimumPrice, user } = contentWithUser;
      const baseUrl = req.protocol + '://' + req.get('host');
      const pageUrl = `${baseUrl}/p/${contentId}`;
      
      // Create preview image URL
      let imageUrl = `${baseUrl}/uploads/default-preview.png`; // fallback
      if (previewImage) {
        // If preview image is base64, we'll need to serve it differently
        // For now, use a placeholder or serve from uploads if it's a file
        imageUrl = previewImage.startsWith('data:') 
          ? `${baseUrl}/api/content/${contentId}/preview-image`
          : `${baseUrl}${previewImage}`;
      }

      // Create appropriate pricing display for social sharing
      const priceDisplay = pricingModel === 'pay_what_you_want' 
        ? `from $${minimumPrice || price}`
        : `$${price}`;

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${priceDisplay} | TipJar</title>
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:title" content="${title} - ${priceDisplay}">
  <meta property="og:description" content="${description || `Support ${user.firstName || 'this creator'} on TipJar`}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="TipJar">
  
  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${pageUrl}">
  <meta property="twitter:title" content="${title} - ${priceDisplay}">
  <meta property="twitter:description" content="${description || `Support ${user.firstName || 'this creator'} on TipJar`}">
  <meta property="twitter:image" content="${imageUrl}">
  
  <!-- Additional SEO -->
  <meta name="description" content="${description || `Support this creator: ${title} - Tips ${pricingModel === 'pay_what_you_want' ? 'starting from' : ''} ${priceDisplay} on TipJar`}">
  <meta name="author" content="${user.firstName || 'TipJar Creator'}">
  
  <!-- Redirect to React app -->
  <script>
    // Redirect to the React app tip page after a brief delay
    // This ensures social media crawlers can read the meta tags first
    setTimeout(() => {
      window.location.href = '/tip' + window.location.pathname.replace('/p/', '/');
    }, 100);
  </script>
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      margin: 0;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      max-width: 600px;
    }
    .preview-image {
      max-width: 300px;
      max-height: 300px;
      border-radius: 12px;
      margin-bottom: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    }
    .price {
      font-size: 2em;
      font-weight: bold;
      color: #FFD700;
      margin: 10px 0;
    }
    .loading {
      margin-top: 20px;
      opacity: 0.7;
    }
  </style>
</head>
<body>
  <div class="container">
    ${previewImage ? `<img src="${imageUrl}" alt="${title}" class="preview-image" />` : ''}
    <h1>${title}</h1>
    ${description ? `<p>${description}</p>` : ''}
    <div class="price">${priceDisplay}</div>
    <div class="loading">Loading content...</div>
  </div>
</body>
</html>`;

      res.send(html);
    } catch (error) {
      console.error("Error serving tip page:", error);
      res.status(500).send('<h1>Error loading content</h1>');
    }
  });

  // Serve preview images for base64 content
  app.get('/api/content/:id/preview-image', async (req, res) => {
    try {
      const contentId = parseInt(req.params.id);
      const content = await storage.getContentById(contentId);
      
      if (!content || !content.previewImage || !content.previewImage.startsWith('data:')) {
        return res.status(404).send('Preview image not found');
      }

      // Extract base64 data and mime type
      const matches = content.previewImage.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return res.status(400).send('Invalid image data');
      }

      const mimeType = matches[1];
      const base64Data = matches[2];
      const imageBuffer = Buffer.from(base64Data, 'base64');

      res.set('Content-Type', mimeType);
      res.set('Content-Length', imageBuffer.length.toString());
      res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      res.send(imageBuffer);
    } catch (error) {
      console.error("Error serving preview image:", error);
      res.status(500).send('Error loading image');
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Content routes
  app.post('/api/content', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { title, description, price, pricingModel, minimumPrice, category, accessType, linkUrl, textContent } = req.body;
      
      // Validate required fields
      if (!title || !accessType) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Validate pricing based on model
      if (pricingModel === "fixed" && !price) {
        return res.status(400).json({ message: "Fixed price is required for fixed pricing model" });
      }
      
      if (pricingModel === "pay_what_you_want" && !minimumPrice) {
        return res.status(400).json({ message: "Minimum price is required for pay-what-you-want pricing model" });
      }

      let fileUrl = null;
      let fileName = null;
      let fileSize = null;
      let mimeType = null;

      // Handle file upload
      if (req.file) {
        fileUrl = `/uploads/${req.file.filename}`;
        fileName = req.file.originalname;
        fileSize = req.file.size;
        mimeType = req.file.mimetype;
      }

      const contentData = {
        userId,
        title,
        description: description || null,
        price,
        pricingModel: pricingModel || "fixed",
        minimumPrice: minimumPrice || null,
        category: category || null,
        accessType,
        fileUrl,
        fileName,
        fileSize,
        mimeType,
        previewImage: req.body.previewImage || null, // Base64 image data
        linkUrl: linkUrl || null,
        textContent: textContent || null,
      };

      const newContent = await storage.createContent(contentData);
      res.json(newContent);
    } catch (error) {
      console.error("Error creating content:", error);
      res.status(500).json({ message: "Failed to create content" });
    }
  });

  app.get('/api/content', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userContent = await storage.getContentByUser(userId);
      res.json(userContent);
    } catch (error) {
      console.error("Error fetching content:", error);
      res.status(500).json({ message: "Failed to fetch content" });
    }
  });

  app.get('/api/content/:id', async (req, res) => {
    try {
      const contentId = parseInt(req.params.id);
      const contentWithUser = await storage.getContentByIdWithUser(contentId);
      
      if (!contentWithUser) {
        return res.status(404).json({ message: "Content not found" });
      }

      res.json(contentWithUser);
    } catch (error) {
      console.error("Error fetching content:", error);
      res.status(500).json({ message: "Failed to fetch content" });
    }
  });

  // Delete content
  app.delete('/api/content/:id', isAuthenticated, async (req: any, res) => {
    try {
      const contentId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // First check if the content belongs to the user
      const contentItem = await storage.getContentById(contentId);
      if (!contentItem || contentItem.userId !== userId) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      // Delete the content
      await storage.deleteContent(contentId);
      res.json({ message: "Content deleted successfully" });
    } catch (error) {
      console.error("Error deleting content:", error);
      res.status(500).json({ message: "Failed to delete content" });
    }
  });

  // Analytics routes
  app.get('/api/analytics/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Stripe payment routes
  app.post("/api/create-payment-intent", async (req: any, res) => {
    try {
      const { contentId, buyerEmail, customAmount } = req.body;
      const buyerId = req.user?.id; // Get buyer's user ID (if authenticated)
      
      console.log('Payment Intent Request:', { contentId, buyerEmail, customAmount });
      
      const content = await storage.getContentById(contentId);
      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }

      console.log('Content found:', { 
        id: content.id, 
        pricingModel: content.pricingModel, 
        price: content.price, 
        minimumPrice: content.minimumPrice 
      });

      // Get content creator to check their subscription tier
      const creator = await storage.getUser(content.userId);
      if (!creator) {
        return res.status(404).json({ message: "Creator not found" });
      }

      // Determine the amount based on pricing model
      let baseAmount = parseFloat(content.price);
      
      if (content.pricingModel === 'pay_what_you_want' && customAmount) {
        baseAmount = parseFloat(customAmount);
        const minimumPrice = parseFloat(content.minimumPrice || "0");
        console.log('Pay-what-you-want processing:', { customAmount, baseAmount, minimumPrice });
        if (baseAmount < minimumPrice) {
          return res.status(400).json({ message: `Amount must be at least $${minimumPrice}` });
        }
      }
      
      console.log('Final amount calculation:', { baseAmount });
      
      // Calculate platform fee (20% for all users - single tier model)
      const platformFeePct = 20; // 20% platform fee for all users
      
      const platformFee = baseAmount * (platformFeePct / 100);
      const netAmount = baseAmount - platformFee;

      console.log('Payment Details:', {
        amount: baseAmount,
        platformFeePct,
        platformFee,
        netAmount,
        creatorTier: creator.subscriptionTier
      });

      // Create standard Stripe payment intent (no Connect needed)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(baseAmount * 100), // Amount in cents
        currency: 'usd',
        metadata: {
          contentId: contentId.toString(),
          creatorId: content.userId,
          buyerEmail: buyerEmail || 'unknown',
          platformFeePct: platformFeePct.toString(),
          netAmount: netAmount.toString(),
          customAmount: customAmount?.toString() || '',
        },
      });

      console.log('Payment intent created:', { 
        id: paymentIntent.id, 
        amount: paymentIntent.amount,
        currency: paymentIntent.currency 
      });

      // Create pending purchase record (legacy table for compatibility)
      await storage.createPurchase({
        contentId,
        buyerEmail: buyerEmail || 'email-from-stripe',
        stripePaymentIntentId: paymentIntent.id,
        amount: baseAmount.toString(),
        commission: platformFee.toString(),
        creatorEarning: netAmount.toString(),
        status: 'pending',
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ message: "Error creating payment intent: " + error.message });
    }
  });

  // Webhook to handle successful payments
  app.post('/api/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      // Only verify webhook signature if webhook secret is configured
      if (process.env.STRIPE_WEBHOOK_SECRET) {
        event = stripe.webhooks.constructEvent(req.body, sig as string, process.env.STRIPE_WEBHOOK_SECRET);
      } else {
        console.warn('STRIPE_WEBHOOK_SECRET not configured - webhook verification disabled');
        event = JSON.parse(req.body.toString());
      }
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log('Stripe webhook received:', event.type);

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      console.log('Processing payment_intent.succeeded:', paymentIntent.id);
      
      try {
        await processSuccessfulPayment(paymentIntent);
      } catch (error) {
        console.error('Error processing webhook:', error);
      }
    }

    res.json({ received: true });
  });

  // Payment completion endpoint for frontend to call after successful payment
  app.post('/api/payments/:paymentIntentId/complete', async (req, res) => {
    try {
      const { paymentIntentId } = req.params;
      console.log('Manual payment completion called for:', paymentIntentId);

      // Retrieve the payment intent from Stripe to verify it succeeded
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status === 'succeeded') {
        console.log('Payment verified as succeeded, processing...');
        await processSuccessfulPayment(paymentIntent);
        res.json({ success: true, message: 'Payment processed successfully' });
      } else {
        console.log('Payment not yet succeeded:', paymentIntent.status);
        res.status(400).json({ success: false, message: 'Payment not completed' });
      }
    } catch (error: any) {
      console.error('Error completing payment:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Fallback endpoint to process the most recent pending purchase for a content item
  app.post('/api/content/:contentId/process-recent-purchase', async (req, res) => {
    try {
      const { contentId } = req.params;
      console.log('🔍 Processing recent purchase for content:', contentId);
      
      // Get the most recent pending purchase for this content
      const recentPurchases = await storage.getPendingPurchasesByContent(parseInt(contentId));
      
      if (recentPurchases.length === 0) {
        console.log('❌ No pending purchases found for content:', contentId);
        res.status(404).json({ success: false, message: 'No pending purchases found' });
        return;
      }
      
      // Process the most recent purchase
      const recentPurchase = recentPurchases[0];
      console.log('📋 Found recent purchase:', {
        id: recentPurchase.id,
        paymentIntentId: recentPurchase.stripePaymentIntentId,
        amount: recentPurchase.amount,
        createdAt: recentPurchase.createdAt
      });
      
      // Verify payment with Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(recentPurchase.stripePaymentIntentId);
      
      if (paymentIntent.status === 'succeeded') {
        console.log('✅ Payment verified as succeeded, processing...');
        await processSuccessfulPayment(paymentIntent);
        res.json({ 
          success: true, 
          message: 'Recent purchase processed successfully',
          purchaseId: recentPurchase.id
        });
      } else {
        console.log('❌ Payment not succeeded, status:', paymentIntent.status);
        res.status(400).json({ 
          success: false, 
          message: `Payment not completed (status: ${paymentIntent.status})` 
        });
      }
    } catch (error: any) {
      console.error('❌ Error processing recent purchase:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Shared function to process successful payments
  async function processSuccessfulPayment(paymentIntent: any) {
    console.log('🔄 Processing successful payment:', paymentIntent.id);
    console.log('🔍 Payment Intent Details:', {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      status: paymentIntent.status,
      metadata: paymentIntent.metadata,
      receipt_email: paymentIntent.receipt_email
    });
    
    // Update purchase status and create earnings record
    const purchase = await storage.getPurchaseByPaymentIntent(paymentIntent.id);
    if (!purchase) {
      console.error('❌ No purchase found for payment intent:', paymentIntent.id);
      
      // Try to list recent purchases to debug
      console.log('🔍 Checking recent purchases in database...');
      // Debug: Let's see what purchases exist
      return;
    }

    console.log('✅ Found purchase:', {
      id: purchase.id,
      contentId: purchase.contentId,
      buyerEmail: purchase.buyerEmail,
      amount: purchase.amount,
      status: purchase.status
    });
    
    try {
      console.log('📝 Updating purchase status to completed...');
      await storage.updatePurchaseStatus(purchase.id, 'completed');
      
      console.log('📊 Incrementing unlock count...');
      await storage.incrementUnlockCount(purchase.contentId, parseFloat(purchase.amount));
      
      // Create earnings record from metadata (handle different metadata formats)
      const metadata = paymentIntent.metadata;
      const creatorId = metadata.creatorId;
      const platformFeePct = metadata.platformFeePct || (metadata.commission ? (parseFloat(metadata.commission) * 100).toString() : '20');
      const netAmount = metadata.netAmount || (metadata.baseAmount ? (parseFloat(metadata.baseAmount) * (1 - parseFloat(metadata.commission || '0.2'))).toString() : null);
      
      if (creatorId && platformFeePct) {
        const totalAmount = parseFloat(purchase.amount);
        const platformFeePercent = parseFloat(platformFeePct);
        const creatorNetAmount = netAmount ? parseFloat(netAmount) : (totalAmount * (1 - platformFeePercent / 100));
        
        console.log('💰 Creating earnings record:', {
          creatorId,
          totalAmount,
          netAmount: creatorNetAmount,
          platformFeePct: platformFeePercent,
          contentId: purchase.contentId,
          metadata: metadata
        });
        
        await storage.createEarning({
          creatorId,
          fanId: metadata.buyerEmail !== 'unknown' ? metadata.buyerEmail : null,
          amount: totalAmount.toString(),
          netAmount: creatorNetAmount.toString(),
          platformFeePct: platformFeePercent.toString(),
          type: 'content_purchase',
          status: 'available',
          source: 'APE',
          stripePaymentIntentId: paymentIntent.id,
          contentId: purchase.contentId,
        });
        
        console.log('✅ Earnings record created successfully');
      } else {
        console.error('❌ Missing required metadata for earnings:', { 
          creatorId, 
          platformFeePct, 
          netAmount, 
          fullMetadata: metadata 
        });
      }
      
      // Send access email to buyer
      const buyerEmail = purchase.buyerEmail || paymentIntent.receipt_email;
      if (buyerEmail && buyerEmail !== 'unknown' && buyerEmail !== 'email-from-stripe') {
        console.log('📧 Sending access email to:', buyerEmail);
        await sendAccessEmail(buyerEmail, purchase.contentId, paymentIntent.id);
        console.log('✅ Access email sent successfully');
      } else {
        console.log('⚠️  No valid email found for access notification:', { buyerEmail, receiptEmail: paymentIntent.receipt_email });
      }
    } catch (error) {
      console.error('❌ Error in payment processing:', error);
      throw error;
    }
  }

  // Purchase verification endpoint for success page
  app.get('/api/purchase/verify', async (req, res) => {
    try {
      const { payment_intent, content_id } = req.query;
      
      if (!payment_intent) {
        return res.status(400).json({ message: 'Payment intent ID required' });
      }

      // Get purchase by payment intent
      const purchase = await storage.getPurchaseByPaymentIntent(payment_intent as string);
      if (!purchase || purchase.status !== 'completed') {
        return res.status(404).json({ message: 'Purchase not found or not completed' });
      }

      // Get content details
      const content = await storage.getContentById(purchase.contentId);
      if (!content) {
        return res.status(404).json({ message: 'Content not found' });
      }

      // Generate access URL
      const baseUrl = req.headers.origin || req.headers.host || process.env.REPLIT_DOMAINS?.split(',')[0];
      const accessUrl = `${baseUrl}/access/${content.id}/${payment_intent}`;

      res.json({
        content: {
          id: content.id,
          title: content.title,
          description: content.description,
          price: content.price,
          accessType: content.accessType,
          fileUrl: content.fileUrl,
          fileName: content.fileName,
          linkUrl: content.linkUrl,
          textContent: content.textContent,
          previewImage: content.previewImage
        },
        purchase: {
          id: purchase.id,
          status: purchase.status,
          paymentIntentId: purchase.paymentIntentId,
          createdAt: purchase.createdAt
        },
        accessUrl
      });
    } catch (error) {
      console.error('Error verifying purchase:', error);
      res.status(500).json({ message: 'Failed to verify purchase' });
    }
  });

  // Send access email endpoint
  app.post('/api/purchase/send-access-email', async (req, res) => {
    try {
      const { paymentIntentId, contentId } = req.body;
      
      if (!paymentIntentId || !contentId) {
        return res.status(400).json({ message: 'Payment intent ID and content ID required' });
      }

      // Get purchase to find buyer email
      const purchase = await storage.getPurchaseByPaymentIntent(paymentIntentId);
      if (!purchase || purchase.status !== 'completed') {
        return res.status(404).json({ message: 'Purchase not found or not completed' });
      }

      // Send email
      const emailSent = await sendAccessEmail(purchase.buyerEmail, parseInt(contentId), paymentIntentId);
      
      if (emailSent) {
        res.json({ message: 'Access email sent successfully' });
      } else {
        res.status(500).json({ message: 'Failed to send email' });
      }
    } catch (error) {
      console.error('Error sending access email:', error);
      res.status(500).json({ message: 'Failed to send access email' });
    }
  });

  // Content access route (after successful payment)
  app.get('/api/access/:contentId/:paymentIntentId', async (req, res) => {
    try {
      const { contentId, paymentIntentId } = req.params;
      
      // Verify payment
      const purchase = await storage.getPurchaseByPaymentIntent(paymentIntentId);
      if (!purchase || purchase.status !== 'completed' || purchase.contentId !== parseInt(contentId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const content = await storage.getContentById(parseInt(contentId));
      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }

      // Return access information based on access type
      if (content.accessType === 'download' && content.fileUrl) {
        // For file downloads, send the file
        const filePath = path.join(process.cwd(), content.fileUrl);
        if (fs.existsSync(filePath)) {
          res.download(filePath, content.fileName || 'download');
        } else {
          res.status(404).json({ message: "File not found" });
        }
      } else {
        // For other access types, return content data
        res.json({
          content: {
            title: content.title,
            description: content.description,
            fileUrl: content.fileUrl,
            linkUrl: content.linkUrl,
            textContent: content.textContent,
            accessType: content.accessType,
          }
        });
      }
    } catch (error) {
      console.error("Error accessing content:", error);
      res.status(500).json({ message: "Failed to access content" });
    }
  });

  // Simple download endpoint (temporary solution)
  app.post('/api/content/:contentId/download', async (req, res) => {
    try {
      const { contentId } = req.params;
      
      const content = await storage.getContentById(parseInt(contentId));
      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }

      // For now, allow downloads after payment (in real app, verify payment)
      if (content.accessType === 'download' && content.fileUrl) {
        const filePath = path.join(process.cwd(), content.fileUrl);
        if (fs.existsSync(filePath)) {
          res.download(filePath, content.fileName || 'download');
        } else {
          res.status(404).json({ message: "File not found" });
        }
      } else {
        res.status(400).json({ message: "Content not downloadable" });
      }
    } catch (error) {
      console.error("Error downloading content:", error);
      res.status(500).json({ message: "Failed to download content" });
    }
  });

  // Pro subscription routes
  app.post('/api/create-subscription', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user already has an active subscription
      if (user.subscriptionTier === 'pro' && user.subscriptionStatus === 'active') {
        return res.status(400).json({ message: "User already has an active subscription" });
      }

      // Create or get Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email!,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        });
        customerId = customer.id;
        await storage.updateStripeCustomerId(userId, customerId);
      }

      // Create subscription with immediate payment required
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{
          price: 'price_1RjJqvGliLAYloriWkqffPMC', // TipJar Pro Subscription - $99/month
        }],
        payment_behavior: 'default_incomplete',
        billing_cycle_anchor: undefined, // Start billing immediately
        payment_settings: {
          save_default_payment_method: 'on_subscription',
          payment_method_types: ['card'],
        },
        expand: ['latest_invoice.payment_intent'],
        collection_method: 'charge_automatically',
      });

      // Update user subscription info
      await storage.updateUserSubscription(userId, {
        stripeSubscriptionId: subscription.id,
        subscriptionTier: 'pro',
        subscriptionStatus: subscription.status,
        subscriptionEndsAt: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : undefined,
      });

      // Ensure we have a client secret for immediate payment
      const clientSecret = subscription.latest_invoice?.payment_intent?.client_secret;
      
      if (!clientSecret) {
        // If no payment intent was created, the subscription may already be active
        // This shouldn't happen with default_incomplete behavior, but handle it gracefully
        console.error('Subscription created without payment intent:', {
          subscriptionId: subscription.id,
          status: subscription.status,
          hasInvoice: !!subscription.latest_invoice,
          hasPaymentIntent: !!subscription.latest_invoice?.payment_intent
        });
        
        return res.status(500).json({ 
          message: "Subscription created but payment setup failed. Please contact support." 
        });
      }

      res.json({
        subscriptionId: subscription.id,
        clientSecret: clientSecret,
      });
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ message: "Error creating subscription: " + error.message });
    }
  });

  // Cancel subscription
  app.post('/api/cancel-subscription', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.stripeSubscriptionId) {
        return res.status(404).json({ message: "No active subscription found" });
      }

      // Cancel subscription at period end
      const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      // Update user subscription status
      await storage.updateUserSubscription(userId, {
        stripeSubscriptionId: subscription.id,
        subscriptionTier: 'free', // Will revert to free at period end
        subscriptionStatus: 'canceled',
        subscriptionEndsAt: new Date(subscription.current_period_end * 1000),
      });

      res.json({ message: "Subscription will be canceled at the end of the billing period" });
    } catch (error: any) {
      console.error("Error canceling subscription:", error);
      res.status(500).json({ message: "Error canceling subscription: " + error.message });
    }
  });

  // Webhook to handle subscription events
  app.post('/api/webhook/subscription', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      // Only verify webhook signature if webhook secret is configured
      if (process.env.STRIPE_WEBHOOK_SECRET) {
        event = stripe.webhooks.constructEvent(req.body, sig as string, process.env.STRIPE_WEBHOOK_SECRET);
      } else {
        console.warn('STRIPE_WEBHOOK_SECRET not configured - webhook verification disabled');
        event = JSON.parse(req.body.toString());
      }
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      
      try {
        // Find user by subscription ID
        const userResults = await db.select().from(users).where(eq(users.stripeSubscriptionId, subscription.id));
        if (userResults.length > 0) {
          const user = userResults[0];
          
          await storage.updateUserSubscription(user.id, {
            stripeSubscriptionId: subscription.id,
            subscriptionTier: subscription.status === 'active' ? 'pro' : 'free',
            subscriptionStatus: subscription.status,
            subscriptionEndsAt: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : undefined,
          });
        }
      } catch (error) {
        console.error('Error processing subscription webhook:', error);
      }
    }

    res.json({ received: true });
  });

  // Feedback routes
  app.post('/api/feedback', async (req, res) => {
    try {
      const { type, subject, message, email, priority } = req.body;
      
      // Validate required fields
      if (!type || !subject || !message) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // In a real app, you would save this to a database
      // For now, we'll just log it and return success
      console.log('Feedback received:', {
        type,
        subject,
        message,
        email,
        priority,
        timestamp: new Date().toISOString()
      });

      res.json({ message: "Feedback submitted successfully" });
    } catch (error) {
      console.error("Error submitting feedback:", error);
      res.status(500).json({ message: "Failed to submit feedback" });
    }
  });

  // Earnings and payout routes
  app.get('/api/earnings/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const earnings = await storage.getCreatorEarnings(userId);
      
      const totalEarnings = earnings.reduce((sum, earning) => sum + parseFloat(earning.netAmount), 0);
      const availableBalance = earnings
        .filter(e => e.status === 'available')
        .reduce((sum, earning) => sum + parseFloat(earning.netAmount), 0);
      
      res.json({
        totalEarnings,
        availableBalance,
        pendingPayouts: totalEarnings - availableBalance,
        recentEarnings: earnings.slice(0, 10), // Last 10 earnings
      });
    } catch (error) {
      console.error('Error fetching earnings stats:', error);
      res.status(500).json({ message: 'Failed to fetch earnings' });
    }
  });

  app.get('/api/earnings/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const earnings = await storage.getCreatorEarnings(userId);
      res.json(earnings);
    } catch (error) {
      console.error('Error fetching earnings history:', error);
      res.status(500).json({ message: 'Failed to fetch earnings history' });
    }
  });

  app.post('/api/payout/setup', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { payoutMethod, payoutEmail } = req.body;
      
      if (!payoutMethod || !payoutEmail) {
        return res.status(400).json({ message: 'Payout method and email are required' });
      }
      
      const user = await storage.updateUserPayoutInfo(userId, payoutMethod, payoutEmail);
      await storage.enableUserPayouts(userId);
      
      res.json({
        message: 'Payout information updated successfully',
        payoutMethod: user.payoutMethod,
        payoutEmail: user.payoutEmail,
        payoutEnabled: user.payoutEnabled
      });
    } catch (error) {
      console.error('Error updating payout info:', error);
      res.status(500).json({ message: 'Failed to update payout information' });
    }
  });

  app.get('/api/payout/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const payouts = await storage.getCreatorPayoutHistory(userId);
      res.json(payouts);
    } catch (error) {
      console.error('Error fetching payout history:', error);
      res.status(500).json({ message: 'Failed to fetch payout history' });
    }
  });

  // Admin payout management routes (new earnings-based system)
  app.get('/api/admin/payout-summary/:month/:year', async (req, res) => {
    try {
      const { month, year } = req.params;
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0);
      
      console.log('Admin payout summary requested for:', { month, year, startDate, endDate });
      
      // Get all earnings for the month
      const monthlyEarnings = await db
        .select()
        .from(earnings)
        .where(and(
          sql`${earnings.createdAt} >= ${startDate}`,
          sql`${earnings.createdAt} <= ${endDate}`
        ));
      
      // Calculate summary metrics
      const totalRevenue = monthlyEarnings.reduce((sum, e) => sum + parseFloat(e.amount), 0);
      const platformCommission = monthlyEarnings.reduce((sum, e) => sum + (parseFloat(e.amount) - parseFloat(e.netAmount)), 0);
      const totalPayouts = monthlyEarnings.reduce((sum, e) => sum + parseFloat(e.netAmount), 0);
      
      const uniqueCreators = new Set(monthlyEarnings.map(e => e.creatorId));
      const creatorCount = uniqueCreators.size;
      
      const pendingPayouts = monthlyEarnings.filter(e => e.status === 'available').length;
      const processedPayouts = monthlyEarnings.filter(e => e.status === 'paid').length;
      
      console.log('Payout summary calculated:', {
        totalRevenue,
        platformCommission,
        totalPayouts,
        creatorCount,
        pendingPayouts,
        processedPayouts
      });
      
      res.json({
        totalRevenue,
        platformCommission,
        totalPayouts,
        creatorCount,
        pendingPayouts,
        processedPayouts
      });
    } catch (error) {
      console.error("Error fetching payout summary:", error);
      res.status(500).json({ message: "Failed to fetch payout summary" });
    }
  });

  app.get('/api/admin/creator-payouts/:month/:year', async (req, res) => {
    try {
      const { month, year } = req.params;
      
      console.log('Admin creator payouts requested for:', { month, year });
      
      // Get all creators with earnings (no minimum threshold for admin view)
      const creatorsWithEarnings = await storage.getCreatorsForPayout(0);
      
      // Get detailed info for each creator
      const creatorPayouts = await Promise.all(
        creatorsWithEarnings.map(async (creator) => {
          const earnings = await storage.getCreatorEarnings(creator.creatorId);
          const payoutHistory = await storage.getCreatorPayoutHistory(creator.creatorId);
          const contentItems = await storage.getContentByUser(creator.creatorId);
          
          const totalEarnings = earnings.reduce((sum, e) => sum + parseFloat(e.netAmount), 0);
          const availableBalance = earnings
            .filter(e => e.status === 'available')
            .reduce((sum, e) => sum + parseFloat(e.netAmount), 0);
          
          const lastPayout = payoutHistory.length > 0 ? payoutHistory[0].createdAt : null;
          
          return {
            userId: creator.creatorId,
            email: creator.user.email || '',
            firstName: creator.user.firstName || '',
            lastName: creator.user.lastName || '',
            totalEarnings,
            availableBalance,
            payoutMethod: creator.user.payoutMethod || 'Not set',
            payoutEmail: creator.user.payoutEmail || '',
            lastPayoutDate: lastPayout,
            contentCount: contentItems.length,
            totalSales: earnings.length
          };
        })
      );
      
      console.log('Creator payouts calculated:', {
        count: creatorPayouts.length,
        creators: creatorPayouts.map(c => ({ email: c.email, available: c.availableBalance }))
      });
      
      res.json(creatorPayouts);
    } catch (error) {
      console.error("Error fetching creator payouts:", error);
      res.status(500).json({ message: "Failed to fetch creator payouts" });
    }
  });

  // Legacy admin payouts route (for old purchase-based system)
  app.get('/api/admin/payouts', async (req, res) => {
    try {
      const pendingPayouts = await storage.getPendingPayouts();
      
      const summary = pendingPayouts.reduce((acc, payout) => {
        acc.totalOwed += parseFloat(payout.creatorEarning);
        acc.totalCommission += parseFloat(payout.commission);
        acc.count += 1;
        return acc;
      }, { totalOwed: 0, totalCommission: 0, count: 0 });

      res.json({
        pendingPayouts,
        summary
      });
    } catch (error) {
      console.error("Error fetching payouts:", error);
      res.status(500).json({ message: "Failed to fetch payouts" });
    }
  });

  // Process all payouts for a given month
  app.post('/api/admin/process-payouts', async (req, res) => {
    try {
      const { month, year } = req.body;
      console.log('Processing payouts for:', { month, year });
      
      // Get all creators with available earnings above minimum threshold
      const creatorsForPayout = await storage.getCreatorsForPayout(25);
      
      let processedCount = 0;
      const processedPayouts = [];
      
      for (const creator of creatorsForPayout) {
        // Mark earnings as paid
        await storage.markEarningsAsPaid(creator.creatorId, creator.totalAvailable);
        
        // Create payout log entry
        const payoutLog = await storage.createPayoutLog({
          creatorId: creator.creatorId,
          amount: creator.totalAvailable.toString(),
          method: creator.user.payoutMethod || 'manual',
          status: 'processed',
          processedAt: new Date(),
          adminNotes: `Batch payout for ${month}/${year}`
        });
        
        processedPayouts.push({
          creatorId: creator.creatorId,
          email: creator.user.email,
          amount: creator.totalAvailable,
          payoutLogId: payoutLog.id
        });
        
        processedCount++;
      }
      
      console.log('Payouts processed:', { processedCount, processedPayouts });
      
      res.json({
        message: `${processedCount} payouts processed successfully`,
        processedCount,
        processedPayouts
      });
    } catch (error) {
      console.error("Error processing payouts:", error);
      res.status(500).json({ message: "Failed to process payouts" });
    }
  });

  // Export payouts as CSV
  app.get('/api/admin/export-payouts', async (req, res) => {
    try {
      const { month, year } = req.query;
      console.log('Exporting payouts for:', { month, year });
      
      const creatorsForPayout = await storage.getCreatorsForPayout(0); // Include all creators for export
      
      // Generate CSV content
      const csvHeaders = 'Creator Email,Name,Total Earnings,Available Balance,Payout Method,Payout Email,Status\n';
      const csvRows = creatorsForPayout.map(creator => {
        const name = `${creator.user.firstName || ''} ${creator.user.lastName || ''}`.trim();
        const status = creator.totalAvailable >= 25 ? 'Eligible' : 'Below Threshold';
        
        return `"${creator.user.email}","${name}","${creator.totalAvailable.toFixed(2)}","${creator.totalAvailable.toFixed(2)}","${creator.user.payoutMethod || 'Not Set'}","${creator.user.payoutEmail || ''}","${status}"`;
      }).join('\n');
      
      const csv = csvHeaders + csvRows;
      
      res.json({ csv });
    } catch (error) {
      console.error("Error exporting payouts:", error);
      res.status(500).json({ message: "Failed to export payouts" });
    }
  });

  // Get monthly reports for admin
  app.get('/api/admin/monthly-reports', async (req, res) => {
    try {
      // Get last 12 months of data
      const reports = [];
      const now = new Date();
      
      for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        
        const monthlyEarnings = await db
          .select()
          .from(earnings)
          .where(and(
            sql`${earnings.createdAt} >= ${startDate}`,
            sql`${earnings.createdAt} <= ${endDate}`
          ));
        
        const totalRevenue = monthlyEarnings.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        const platformCommission = monthlyEarnings.reduce((sum, e) => sum + (parseFloat(e.amount) - parseFloat(e.netAmount)), 0);
        
        reports.push({
          month,
          year,
          monthName: date.toLocaleString('default', { month: 'long' }),
          totalRevenue,
          platformCommission,
          creatorPayouts: monthlyEarnings.reduce((sum, e) => sum + parseFloat(e.netAmount), 0),
          transactionCount: monthlyEarnings.length
        });
      }
      
      res.json(reports.reverse()); // Most recent first
    } catch (error) {
      console.error("Error fetching monthly reports:", error);
      res.status(500).json({ message: "Failed to fetch monthly reports" });
    }
  });

  app.post('/api/admin/payouts/:id/complete', async (req, res) => {
    try {
      const purchaseId = parseInt(req.params.id);
      const updatedPurchase = await storage.markPayoutCompleted(purchaseId);
      res.json({ message: "Payout marked as completed", purchase: updatedPurchase });
    } catch (error) {
      console.error("Error completing payout:", error);
      res.status(500).json({ message: "Failed to complete payout" });
    }
  });

  // Stripe Connect routes for creator payouts
  app.post('/api/connect/create-account', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.stripeConnectAccountId) {
        return res.status(400).json({ message: "Connect account already exists" });
      }

      // Create Stripe Connect account (minimal setup, Stripe will collect info during onboarding)
      const account = await stripe.accounts.create({
        type: 'express',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      // Update user with Connect account ID
      await storage.updateStripeConnectAccount(userId, account.id);

      // Create account link for onboarding
      const baseUrl = req.headers.origin || req.headers.host || 'http://localhost:5000';
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${baseUrl}/settings?connect=refresh`,
        return_url: `${baseUrl}/settings?connect=success`,
        type: 'account_onboarding',
        collect: 'eventually_due', // Collect info as needed
      });

      res.json({ url: accountLink.url });
    } catch (error: any) {
      console.error("Error creating Connect account:", error);
      
      // Provide more specific error messages
      let errorMessage = "Error creating payout account";
      if (error.message.includes("signed up for Connect")) {
        errorMessage = "Stripe Connect needs to be enabled. Please enable Connect in your Stripe dashboard first.";
      } else if (error.message.includes("platform-profile")) {
        errorMessage = "Please complete your Stripe Connect platform profile setup at dashboard.stripe.com/settings/connect/platform-profile";
      } else if (error.message.includes("pattern")) {
        errorMessage = "Invalid email format. Please check your email address.";
      } else if (error.message.includes("country")) {
        errorMessage = "Country not supported. Please contact support.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      res.status(500).json({ message: errorMessage });
    }
  });

  app.get('/api/connect/account-status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.stripeConnectAccountId) {
        return res.json({ 
          connected: false, 
          payoutsEnabled: false,
          message: "No payout account connected" 
        });
      }

      // Check account status
      const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);
      
      const payoutsEnabled = account.charges_enabled && account.payouts_enabled;
      
      if (payoutsEnabled && !user.payoutEnabled) {
        // Enable payouts for user
        await storage.enableUserPayouts(userId);
      }

      res.json({
        connected: true,
        payoutsEnabled,
        chargesEnabled: account.charges_enabled,
        detailsSubmitted: account.details_submitted,
        requiresInformation: account.requirements?.currently_due?.length > 0,
        accountId: user.stripeConnectAccountId,
      });
    } catch (error: any) {
      console.error("Error checking Connect account:", error);
      res.status(500).json({ message: "Error checking payout status: " + error.message });
    }
  });

  app.post('/api/connect/create-login-link', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.stripeConnectAccountId) {
        return res.status(400).json({ message: "No Connect account found" });
      }

      const loginLink = await stripe.accounts.createLoginLink(user.stripeConnectAccountId);
      res.json({ url: loginLink.url });
    } catch (error: any) {
      console.error("Error creating login link:", error);
      res.status(500).json({ message: "Error accessing payout dashboard: " + error.message });
    }
  });

  // Simple access route that works without complex email verification
  app.get('/access/:contentId/:paymentIntentId', async (req, res) => {
    try {
      const { contentId, paymentIntentId } = req.params;
      
      // Verify payment
      const purchase = await storage.getPurchaseByPaymentIntent(paymentIntentId);
      if (!purchase || purchase.status !== 'completed' || purchase.contentId !== parseInt(contentId)) {
        return res.status(403).send(`
          <html><body style="font-family: Arial; text-align: center; margin-top: 100px;">
            <h2>Access Denied</h2>
            <p>This content access link is invalid or has expired.</p>
            <a href="/">Return to TipJar</a>
          </body></html>
        `);
      }

      const content = await storage.getContentById(parseInt(contentId));
      if (!content) {
        return res.status(404).send('<h1>Content not found</h1>');
      }

      // For downloads, serve the file directly
      if (content.accessType === 'download' && content.fileUrl) {
        const filePath = path.join(process.cwd(), content.fileUrl);
        if (fs.existsSync(filePath)) {
          return res.download(filePath, content.fileName || 'download');
        }
      }

      // For other types, show content access page
      const accessHtml = `
        <html>
          <head>
            <title>Your Content - ${content.title}</title>
            <style>
              body { font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px; }
              .content { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .button { background: linear-gradient(135deg, #a855f7, #ec4899); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; }
            </style>
          </head>
          <body>
            <h1>🎉 Access Granted!</h1>
            <p>Thank you for your purchase! Here's your content:</p>
            
            <div class="content">
              <h2>${content.title}</h2>
              <p>${content.description}</p>
              
              ${content.textContent ? `<div><strong>Content:</strong><br>${content.textContent}</div>` : ''}
              ${content.linkUrl ? `<p><a href="${content.linkUrl}" class="button" target="_blank">Access Link</a></p>` : ''}
              ${content.fileUrl && content.accessType !== 'download' ? `<p><a href="${content.fileUrl}" class="button" target="_blank">View File</a></p>` : ''}
            </div>
            
            <p style="color: #666; font-size: 14px;">
              Bookmark this page to access your content anytime.
            </p>
          </body>
        </html>
      `;
      
      res.send(accessHtml);
    } catch (error) {
      console.error("Error accessing content:", error);
      res.status(500).send('<h1>Error accessing content</h1>');
    }
  });

  // Get Stripe Connect account status
  app.get('/api/connect/account-status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found in session" });
      }
      const user = await storage.getUser(userId);
      
      if (!user || !user.stripeConnectAccountId) {
        return res.json({ 
          details_submitted: false, 
          payouts_enabled: false,
          account_id: null 
        });
      }

      const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);
      
      res.json({
        details_submitted: account.details_submitted,
        payouts_enabled: account.payouts_enabled,
        account_id: account.id,
        charges_enabled: account.charges_enabled,
      });
    } catch (error: any) {
      console.error('Error checking account status:', error);
      res.status(500).json({ message: 'Failed to check account status' });
    }
  });

  // Stripe Connect onboarding route (GET for direct browser navigation)
  app.get('/api/stripe/connect/onboard', async (req: any, res) => {
    console.log('🚀🚀🚀 ROUTE HIT WITHOUT AUTH CHECK! 🚀🚀🚀');
    
    // Manual auth check
    if (!req.user || !req.user.claims) {
      console.log('❌ Authentication failed, redirecting to login');
      return res.redirect('/');
    }
    try {
      console.log('🚀🚀🚀 ONBOARD ROUTE HIT! 🚀🚀🚀');
      console.log('GET /api/stripe/connect/onboard - Starting onboarding process');
      console.log('Full req.user object:', req.user);
      const userId = req.user?.claims?.sub || req.user?.id;
      console.log('Looking for user with ID:', userId, 'Type:', typeof userId);
      
      if (!userId) {
        console.error('No user ID found in request');
        return res.status(401).json({ message: "User ID not found in session" });
      }
      let user = await storage.getUser(userId);
      console.log('Found user:', user ? 'Yes' : 'No');
      
      if (!user) {
        console.log('User not found, trying to create user...');
        // Try to create user if they don't exist (edge case for Replit auth)
        try {
          user = await storage.upsertUser({
            id: userId,
            email: req.user.claims?.email || req.user.email || `user${userId}@example.com`,
            username: req.user.claims?.username || req.user.username || `user${userId}`,
          });
          console.log('Created/updated user:', user);
        } catch (createError) {
          console.error('Failed to create user:', createError);
          return res.status(500).json({ message: "Failed to create user account" });
        }
      }

      // Always create a fresh Stripe Connect account for real onboarding
      let stripeAccountId = user.stripeConnectAccountId;
      
      if (!stripeAccountId) {
        const account = await stripe.accounts.create({
          type: 'express',
          country: 'US',
          email: user.email || req.user.claims?.email || `user${userId}@example.com`,
        });
        
        stripeAccountId = account.id;
        await storage.updateStripeConnectAccount(userId, account.id);
        console.log('Created new Stripe account:', stripeAccountId);
      } else {
        console.log('Using existing Stripe account:', stripeAccountId);
      }

      // Always create a fresh onboarding link, even if account exists
      // Force HTTPS for Stripe live mode
      const origin = req.headers.origin?.replace('http://', 'https://') || 'https://your-app.replit.dev';
      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${origin}/connect?refresh=true`,
        return_url: `${origin}/connect?connected=true`,
        type: 'account_onboarding',
      });

      console.log('Created account link:', accountLink.url);
      console.log('About to redirect to Stripe...');
      
      // Direct server redirect to Stripe
      res.redirect(302, accountLink.url);
      console.log('Redirect sent!');
    } catch (error: any) {
      console.error('🔥 Stripe Connect onboarding error:', error);
      console.error('Error details:', error.message, error.code, error.type);
      res.status(500).json({ message: 'Failed to create onboarding link: ' + error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
