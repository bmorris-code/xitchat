import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../theme/app_theme.dart';

class JoeBankerView extends StatefulWidget {
  const JoeBankerView({super.key});

  @override
  State<JoeBankerView> createState() => _JoeBankerViewState();
}

class _JoeBankerViewState extends State<JoeBankerView> {
  final TextEditingController _amountController = TextEditingController();
  final TextEditingController _recipientController = TextEditingController();
  String _selectedTransactionType = 'send';

  @override
  Widget build(BuildContext context) {
    return Consumer<AppProvider>(
      builder: (context, appProvider, child) {
        return Scaffold(
          backgroundColor: AppTheme.background,
          appBar: AppBar(
            title: const Text('JOE BANKER'),
            backgroundColor: AppTheme.background,
            elevation: 0,
            iconTheme: const IconThemeData(color: AppTheme.primaryGreen),
          ),
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Balance Card
                _buildBalanceCard(appProvider),
                const SizedBox(height: 24),
                
                // Transaction Type Selector
                _buildTransactionTypeSelector(),
                const SizedBox(height: 24),
                
                // Transaction Form
                _buildTransactionForm(appProvider),
                const SizedBox(height: 24),
                
                // Recent Transactions
                _buildRecentTransactions(appProvider),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildBalanceCard(AppProvider appProvider) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppTheme.primaryGreen.withOpacity(0.2),
            AppTheme.primaryGreen.withOpacity(0.1),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: AppTheme.primaryGreen, width: 1),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'XC BALANCE',
            style: TextStyle(
              color: AppTheme.primaryGreen,
              fontSize: 12,
              fontWeight: FontWeight.bold,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${appProvider.currentBalance} XC',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 32,
              fontWeight: FontWeight.bold,
              fontFamily: 'monospace',
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '≈ \$${(0.01 * 1000).toStringAsFixed(2)} USD',
            style: const TextStyle(
              color: AppTheme.darkGreen,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTransactionTypeSelector() {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: AppTheme.darkGreen, width: 1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _selectedTransactionType = 'send'),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: _selectedTransactionType == 'send' 
                      ? AppTheme.primaryGreen.withOpacity(0.2) 
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  'SEND',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: _selectedTransactionType == 'send' 
                        ? AppTheme.primaryGreen 
                        : AppTheme.darkGreen,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1,
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _selectedTransactionType = 'receive'),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: _selectedTransactionType == 'receive' 
                      ? AppTheme.primaryGreen.withOpacity(0.2) 
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  'RECEIVE',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: _selectedTransactionType == 'receive' 
                        ? AppTheme.primaryGreen 
                        : AppTheme.darkGreen,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTransactionForm(AppProvider appProvider) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: AppTheme.darkGreen, width: 1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _selectedTransactionType == 'send' ? 'SEND XC' : 'REQUEST XC',
            style: const TextStyle(
              color: AppTheme.primaryGreen,
              fontSize: 16,
              fontWeight: FontWeight.bold,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 16),
          
          if (_selectedTransactionType == 'send') ...[
            TextField(
              controller: _recipientController,
              decoration: InputDecoration(
                hintText: 'Recipient handle (@user)',
                hintStyle: TextStyle(color: AppTheme.darkGreen.withOpacity(0.6)),
                border: const OutlineInputBorder(
                  borderSide: BorderSide(color: AppTheme.darkGreen),
                ),
                enabledBorder: const OutlineInputBorder(
                  borderSide: BorderSide(color: AppTheme.darkGreen),
                ),
                focusedBorder: const OutlineInputBorder(
                  borderSide: BorderSide(color: AppTheme.primaryGreen),
                ),
              ),
              style: const TextStyle(color: Colors.white),
            ),
            const SizedBox(height: 16),
          ],
          
          TextField(
            controller: _amountController,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              hintText: 'Amount in XC',
              hintStyle: TextStyle(color: AppTheme.darkGreen.withOpacity(0.6)),
              border: const OutlineInputBorder(
                borderSide: BorderSide(color: AppTheme.darkGreen),
              ),
              enabledBorder: const OutlineInputBorder(
                borderSide: BorderSide(color: AppTheme.darkGreen),
              ),
              focusedBorder: const OutlineInputBorder(
                borderSide: BorderSide(color: AppTheme.primaryGreen),
              ),
            ),
            style: const TextStyle(color: Colors.white),
          ),
          const SizedBox(height: 16),
          
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => _handleTransaction(appProvider),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryGreen,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: Text(
                _selectedTransactionType == 'send' ? 'SEND XC' : 'REQUEST XC',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecentTransactions(AppProvider appProvider) {
    final transactions = appProvider.getTransactions();
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: AppTheme.darkGreen, width: 1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'RECENT TRANSACTIONS',
            style: TextStyle(
              color: AppTheme.primaryGreen,
              fontSize: 12,
              fontWeight: FontWeight.bold,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 16),
          
          if (transactions.isEmpty)
            Text(
              'No transactions yet',
              style: TextStyle(
                color: AppTheme.darkGreen.withOpacity(0.6),
              ),
            )
          else
            ...transactions.take(5).map((transaction) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: transaction.type == 'received' 
                          ? Colors.green.withOpacity(0.2)
                          : Colors.red.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Icon(
                      transaction.type == 'received' 
                          ? Icons.arrow_downward
                          : Icons.arrow_upward,
                      color: transaction.type == 'received' 
                          ? Colors.green
                          : Colors.red,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          transaction.description,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          transaction.timestamp.toString().substring(0, 19),
                          style: TextStyle(
                            color: AppTheme.darkGreen.withOpacity(0.6),
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    '${transaction.type == 'received' ? '+' : '-'}${transaction.amount} XC',
                    style: TextStyle(
                      color: transaction.type == 'received' 
                          ? Colors.green
                          : Colors.red,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            )),
        ],
      ),
    );
  }

  void _handleTransaction(AppProvider appProvider) {
    final amount = double.tryParse(_amountController.text);
    if (amount == null || amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a valid amount'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    if (_selectedTransactionType == 'send' && _recipientController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a recipient'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    // Handle transaction logic
    if (_selectedTransactionType == 'send') {
      appProvider.purchaseItem(_recipientController.text, amount.toInt());
    } else {
      appProvider.sellItem('request', amount.toInt());
    }

    _amountController.clear();
    _recipientController.clear();

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${_selectedTransactionType == 'send' ? 'Sent' : 'Requested'} $amount XC'),
        backgroundColor: AppTheme.primaryGreen,
      ),
    );
  }

  @override
  void dispose() {
    _amountController.dispose();
    _recipientController.dispose();
    super.dispose();
  }
}
