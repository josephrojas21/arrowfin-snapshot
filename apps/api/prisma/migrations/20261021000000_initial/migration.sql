CREATE TABLE "Trader" ("id" TEXT NOT NULL, "brokerId" TEXT NOT NULL, CONSTRAINT "Trader_pkey" PRIMARY KEY ("id"));
CREATE TABLE "Account" ("id" TEXT NOT NULL, "traderId" TEXT NOT NULL, "brokerId" TEXT NOT NULL, "status" TEXT NOT NULL, "balance" DECIMAL(24,8) NOT NULL, CONSTRAINT "Account_pkey" PRIMARY KEY ("id"));
CREATE TABLE "Instrument" ("symbol" TEXT NOT NULL, "pointValue" DECIMAL(24,8) NOT NULL, "initialMargin" DECIMAL(24,8) NOT NULL, "markPrice" DECIMAL(24,8) NOT NULL, CONSTRAINT "Instrument_pkey" PRIMARY KEY ("symbol"));
CREATE TABLE "Fill" ("id" TEXT NOT NULL, "sequence" SERIAL NOT NULL, "accountId" TEXT NOT NULL, "instrumentSymbol" TEXT NOT NULL, "side" TEXT NOT NULL, "quantity" INTEGER NOT NULL, "price" DECIMAL(24,8) NOT NULL, "commission" DECIMAL(24,8) NOT NULL, "filledAt" TIMESTAMP(3) NOT NULL, "orderId" TEXT NOT NULL, CONSTRAINT "Fill_pkey" PRIMARY KEY ("id"), CONSTRAINT "Fill_side_check" CHECK ("side" IN ('BUY', 'SELL')), CONSTRAINT "Fill_quantity_check" CHECK ("quantity" > 0), CONSTRAINT "Fill_price_check" CHECK ("price" > 0), CONSTRAINT "Fill_commission_check" CHECK ("commission" >= 0));
CREATE UNIQUE INDEX "Trader_id_brokerId_key" ON "Trader"("id", "brokerId");
CREATE INDEX "Account_brokerId_traderId_idx" ON "Account"("brokerId", "traderId");
CREATE INDEX "Fill_accountId_filledAt_idx" ON "Fill"("accountId", "filledAt");
ALTER TABLE "Account" ADD CONSTRAINT "Account_traderId_brokerId_fkey" FOREIGN KEY ("traderId", "brokerId") REFERENCES "Trader"("id", "brokerId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Fill" ADD CONSTRAINT "Fill_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Fill" ADD CONSTRAINT "Fill_instrumentSymbol_fkey" FOREIGN KEY ("instrumentSymbol") REFERENCES "Instrument"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Fill_sequence_key" ON "Fill"("sequence");
