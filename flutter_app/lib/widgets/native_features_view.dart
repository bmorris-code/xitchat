import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../theme/app_theme.dart';

class NativeFeaturesView extends StatefulWidget {
  const NativeFeaturesView({super.key});

  @override
  State<NativeFeaturesView> createState() => _NativeFeaturesViewState();
}

class _NativeFeaturesViewState extends State<NativeFeaturesView> with TickerProviderStateMixin {
  late TabController _tabController;
  final ImagePicker _imagePicker = ImagePicker();
  
  // Feature states
  bool _bluetoothEnabled = false;
  bool _locationEnabled = false;
  bool _cameraEnabled = false;
  bool _storageEnabled = false;
  bool _wifiEnabled = false;
  String _connectionStatus = 'Unknown';
  Position? _currentPosition;
  String? _selectedImagePath;
  String? _selectedFilePath;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _checkPermissions();
    _checkConnectivity();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _checkPermissions() async {
    final bluetoothStatus = await Permission.bluetooth.status;
    final locationStatus = await Permission.location.status;
    final cameraStatus = await Permission.camera.status;
    final storageStatus = await Permission.storage.status;

    setState(() {
      _bluetoothEnabled = bluetoothStatus.isGranted;
      _locationEnabled = locationStatus.isGranted;
      _cameraEnabled = cameraStatus.isGranted;
      _storageEnabled = storageStatus.isGranted;
    });

    if (locationStatus.isGranted) {
      _getCurrentLocation();
    }
  }

  Future<void> _checkConnectivity() async {
    final connectivity = await Connectivity().checkConnectivity();
    
    setState(() {
      // connectivity is a List<ConnectivityResult>, so we check if it contains our target
      if (connectivity.contains(ConnectivityResult.wifi)) {
        _connectionStatus = 'WiFi';
        _wifiEnabled = true;
      } else if (connectivity.contains(ConnectivityResult.mobile)) {
        _connectionStatus = 'Mobile';
      } else if (connectivity.contains(ConnectivityResult.ethernet)) {
        _connectionStatus = 'Ethernet';
      } else if (connectivity.contains(ConnectivityResult.bluetooth)) {
        _connectionStatus = 'Bluetooth';
      } else if (connectivity.contains(ConnectivityResult.none)) {
        _connectionStatus = 'Offline';
      } else {
        _connectionStatus = 'Unknown';
      }
    });
  }

  Future<void> _getCurrentLocation() async {
    try {
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      setState(() {
        _currentPosition = position;
      });
    } catch (e) {
      print('Error getting location: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('NATIVE FEATURES'),
        backgroundColor: AppTheme.background,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppTheme.primaryGreen,
          labelColor: AppTheme.primaryGreen,
          unselectedLabelColor: AppTheme.darkGreen,
          tabs: const [
            Tab(text: 'SENSORS'),
            Tab(text: 'MEDIA'),
            Tab(text: 'STORAGE'),
            Tab(text: 'NETWORK'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildSensorsTab(),
          _buildMediaTab(),
          _buildStorageTab(),
          _buildNetworkTab(),
        ],
      ),
    );
  }

  Widget _buildSensorsTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildPermissionCard(
            'BLUETOOTH',
            Icons.bluetooth,
            _bluetoothEnabled,
            () => _requestPermission(Permission.bluetooth),
          ),
          const SizedBox(height: 16),
          
          _buildPermissionCard(
            'LOCATION',
            Icons.location_on,
            _locationEnabled,
            () => _requestPermission(Permission.location),
          ),
          const SizedBox(height: 16),
          
          _buildLocationCard(),
          const SizedBox(height: 16),
          
          _buildPermissionCard(
            'CAMERA',
            Icons.camera_alt,
            _cameraEnabled,
            () => _requestPermission(Permission.camera),
          ),
          const SizedBox(height: 16),
          
          _buildPermissionCard(
            'STORAGE',
            Icons.storage,
            _storageEnabled,
            () => _requestPermission(Permission.storage),
          ),
        ],
      ),
    );
  }

  Widget _buildMediaTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'MEDIA ACCESS',
            style: TextStyle(
              color: AppTheme.primaryGreen,
              fontSize: 16,
              fontWeight: FontWeight.bold,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 20),
          
          _buildMediaCard(
            'Camera',
            Icons.photo_camera,
            'Take photos with device camera',
            () => _takePicture(),
          ),
          const SizedBox(height: 16),
          
          _buildMediaCard(
            'Gallery',
            Icons.photo_library,
            'Pick images from gallery',
            () => _pickImage(),
          ),
          const SizedBox(height: 16),
          
          _buildMediaCard(
            'Video',
            Icons.videocam,
            'Record videos with camera',
            () => _recordVideo(),
          ),
          const SizedBox(height: 20),
          
          if (_selectedImagePath != null) ...[
            const Text(
              'SELECTED IMAGE',
              style: TextStyle(
                color: AppTheme.primaryGreen,
                fontSize: 14,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              height: 200,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.primaryGreen, width: 1),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.file(
                  File(_selectedImagePath!),
                  fit: BoxFit.cover,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStorageTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'FILE SYSTEM',
            style: TextStyle(
              color: AppTheme.primaryGreen,
              fontSize: 16,
              fontWeight: FontWeight.bold,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 20),
          
          _buildStorageCard(
            'Pick File',
            Icons.file_open,
            'Select any file from device',
            () => _pickFile(),
          ),
          const SizedBox(height: 16),
          
          _buildStorageCard(
            'Pick Directory',
            Icons.folder_open,
            'Select a directory',
            () => _pickDirectory(),
          ),
          const SizedBox(height: 16),
          
          _buildStorageCard(
            'Save File',
            Icons.save,
            'Save file to device',
            () => _saveFile(),
          ),
          const SizedBox(height: 20),
          
          if (_selectedFilePath != null) ...[
            const Text(
              'SELECTED FILE',
              style: TextStyle(
                color: AppTheme.primaryGreen,
                fontSize: 14,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                border: Border.all(color: AppTheme.darkGreen, width: 1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.insert_drive_file,
                    color: AppTheme.primaryGreen,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _selectedFilePath!.split('/').last,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildNetworkTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'NETWORK STATUS',
            style: TextStyle(
              color: AppTheme.primaryGreen,
              fontSize: 16,
              fontWeight: FontWeight.bold,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 20),
          
          _buildNetworkStatusCard(),
          const SizedBox(height: 16),
          
          _buildNetworkCard(
            'WiFi Direct',
            Icons.wifi,
            'Direct device-to-device connection',
            _wifiEnabled,
            () => _testWiFiDirect(),
          ),
          const SizedBox(height: 16),
          
          _buildNetworkCard(
            'Bluetooth LE',
            Icons.bluetooth,
            'Low energy Bluetooth scanning',
            _bluetoothEnabled,
            () => _testBluetooth(),
          ),
          const SizedBox(height: 16),
          
          _buildNetworkCard(
            'Mobile Data',
            Icons.signal_cellular_alt,
            'Cellular network connection',
            _connectionStatus == 'Mobile',
            () => _testMobileData(),
          ),
        ],
      ),
    );
  }

  Widget _buildPermissionCard(String title, IconData icon, bool enabled, VoidCallback onTap) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(
          color: enabled ? AppTheme.primaryGreen : AppTheme.darkGreen,
          width: enabled ? 2 : 1,
        ),
        borderRadius: BorderRadius.circular(12),
        color: enabled ? AppTheme.primaryGreen.withOpacity(0.1) : Colors.transparent,
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: enabled ? AppTheme.primaryGreen.withOpacity(0.2) : AppTheme.darkGreen.withOpacity(0.2),
              borderRadius: BorderRadius.circular(24),
            ),
            child: Icon(
              icon,
              color: enabled ? AppTheme.primaryGreen : AppTheme.darkGreen,
              size: 24,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: enabled ? Colors.white : AppTheme.darkGreen,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  enabled ? 'Permission granted' : 'Permission required',
                  style: TextStyle(
                    color: enabled ? AppTheme.primaryGreen : AppTheme.darkGreen.withOpacity(0.6),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          if (!enabled)
            ElevatedButton(
              onPressed: onTap,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryGreen,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              ),
              child: const Text(
                'GRANT',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            )
          else
            const Icon(
              Icons.check_circle,
              color: AppTheme.primaryGreen,
              size: 24,
            ),
        ],
      ),
    );
  }

  Widget _buildLocationCard() {
    if (_currentPosition == null) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          border: Border.all(color: AppTheme.darkGreen, width: 1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(
                  Icons.location_off,
                  color: AppTheme.darkGreen,
                  size: 24,
                ),
                SizedBox(width: 12),
                Text(
                  'Location Unavailable',
                  style: TextStyle(
                    color: AppTheme.darkGreen,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Enable location permission to see current coordinates',
              style: TextStyle(
                color: AppTheme.darkGreen.withOpacity(0.6),
                fontSize: 12,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: AppTheme.primaryGreen, width: 1),
        borderRadius: BorderRadius.circular(12),
        color: AppTheme.primaryGreen.withOpacity(0.1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.location_on,
                color: AppTheme.primaryGreen,
                size: 24,
              ),
              SizedBox(width: 12),
              Text(
                'Current Location',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _buildLocationRow('Latitude', '${_currentPosition!.latitude.toStringAsFixed(6)}°'),
          _buildLocationRow('Longitude', '${_currentPosition!.longitude.toStringAsFixed(6)}°'),
          _buildLocationRow('Accuracy', '${_currentPosition!.accuracy.toStringAsFixed(2)}m'),
          _buildLocationRow('Altitude', '${_currentPosition!.altitude.toStringAsFixed(2)}m'),
          _buildLocationRow('Speed', '${_currentPosition!.speed.toStringAsFixed(2)}m/s'),
        ],
      ),
    );
  }

  Widget _buildLocationRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color: AppTheme.darkGreen.withOpacity(0.8),
              fontSize: 12,
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontFamily: 'monospace',
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMediaCard(String title, IconData icon, String description, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          border: Border.all(color: AppTheme.darkGreen, width: 1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: AppTheme.primaryGreen.withOpacity(0.2),
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Icon(
                Icons.photo,
                color: AppTheme.primaryGreen,
                size: 24,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: TextStyle(
                      color: AppTheme.darkGreen.withOpacity(0.8),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.arrow_forward_ios,
              color: AppTheme.darkGreen,
              size: 16,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStorageCard(String title, IconData icon, String description, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          border: Border.all(color: AppTheme.darkGreen, width: 1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: AppTheme.primaryGreen.withOpacity(0.2),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Icon(
                icon,
                color: AppTheme.primaryGreen,
                size: 24,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: TextStyle(
                      color: AppTheme.darkGreen.withOpacity(0.8),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.arrow_forward_ios,
              color: AppTheme.darkGreen,
              size: 16,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNetworkStatusCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: AppTheme.primaryGreen, width: 2),
        borderRadius: BorderRadius.circular(12),
        color: AppTheme.primaryGreen.withOpacity(0.1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.network_check,
                color: AppTheme.primaryGreen,
                size: 24,
              ),
              SizedBox(width: 12),
              Text(
                'Connection Status',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Current Network',
                style: TextStyle(
                  color: AppTheme.darkGreen.withOpacity(0.8),
                  fontSize: 12,
                ),
              ),
              Text(
                _connectionStatus,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Status',
                style: TextStyle(
                  color: AppTheme.darkGreen.withOpacity(0.8),
                  fontSize: 12,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: _connectionStatus != 'Offline' 
                      ? Colors.green.withOpacity(0.2)
                      : Colors.red.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _connectionStatus != 'Offline' ? 'Connected' : 'Offline',
                  style: TextStyle(
                    color: _connectionStatus != 'Offline' ? Colors.green : Colors.red,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildNetworkCard(String title, IconData icon, String description, bool enabled, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          border: Border.all(
            color: enabled ? AppTheme.primaryGreen : AppTheme.darkGreen,
            width: enabled ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(12),
          color: enabled ? AppTheme.primaryGreen.withOpacity(0.1) : Colors.transparent,
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: enabled ? AppTheme.primaryGreen.withOpacity(0.2) : AppTheme.darkGreen.withOpacity(0.2),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Icon(
                icon,
                color: enabled ? AppTheme.primaryGreen : AppTheme.darkGreen,
                size: 24,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      color: enabled ? Colors.white : AppTheme.darkGreen,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: TextStyle(
                      color: enabled ? AppTheme.darkGreen : AppTheme.darkGreen.withOpacity(0.6),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              enabled ? Icons.check_circle : Icons.help_outline,
              color: enabled ? AppTheme.primaryGreen : AppTheme.darkGreen,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _requestPermission(Permission permission) async {
    final status = await permission.request();
    setState(() {
      switch (permission) {
        case Permission.bluetooth:
          _bluetoothEnabled = status.isGranted;
          break;
        case Permission.location:
          _locationEnabled = status.isGranted;
          if (status.isGranted) {
            _getCurrentLocation();
          }
          break;
        case Permission.camera:
          _cameraEnabled = status.isGranted;
          break;
        case Permission.storage:
          _storageEnabled = status.isGranted;
          break;
        default:
          break;
      }
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          status.isGranted ? 'Permission granted' : 'Permission denied',
        ),
        backgroundColor: status.isGranted ? AppTheme.primaryGreen : Colors.red,
      ),
    );
  }

  Future<void> _takePicture() async {
    try {
      final XFile? image = await _imagePicker.pickImage(source: ImageSource.camera);
      if (image != null) {
        setState(() {
          _selectedImagePath = image.path;
        });
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to take picture'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _pickImage() async {
    try {
      final XFile? image = await _imagePicker.pickImage(source: ImageSource.gallery);
      if (image != null) {
        setState(() {
          _selectedImagePath = image.path;
        });
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to pick image'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _recordVideo() async {
    try {
      final XFile? video = await _imagePicker.pickVideo(source: ImageSource.camera);
      if (video != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Video saved: ${video.path}'),
            backgroundColor: AppTheme.primaryGreen,
          ),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to record video'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _pickFile() async {
    try {
      FilePickerResult? result = await FilePicker.platform.pickFiles();
      if (result != null) {
        setState(() {
          _selectedFilePath = result.files.single.path;
        });
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to pick file'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _pickDirectory() async {
    try {
      String? directory = await FilePicker.platform.getDirectoryPath();
      if (directory != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Directory selected: $directory'),
            backgroundColor: AppTheme.primaryGreen,
          ),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to pick directory'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _saveFile() async {
    try {
      String? outputFile = await FilePicker.platform.saveFile(
        dialogTitle: 'Save File',
        fileName: 'xitchat_data.txt',
        type: FileType.custom,
        allowedExtensions: ['txt'],
      );
      
      if (outputFile != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('File saved: $outputFile'),
            backgroundColor: AppTheme.primaryGreen,
          ),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to save file'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  void _testWiFiDirect() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('WiFi Direct test initiated'),
        backgroundColor: AppTheme.primaryGreen,
      ),
    );
  }

  void _testBluetooth() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Bluetooth LE test initiated'),
        backgroundColor: AppTheme.primaryGreen,
      ),
    );
  }

  void _testMobileData() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Mobile data test initiated'),
        backgroundColor: AppTheme.primaryGreen,
      ),
    );
  }
}
