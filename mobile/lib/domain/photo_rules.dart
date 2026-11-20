/// The content type sent with a photo. PNG files are sent as PNG and everything else as JPEG.
/// The camera picker returns JPEG by default. Confirm this on a device.
String photoContentType(String path) =>
    path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
