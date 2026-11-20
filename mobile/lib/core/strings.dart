/// User-facing text. English is wired in this slice.
///
/// Somali strings approved by the client are kept in [SomaliApproved] so they
/// can be wired in once the locale switch exists. Strings marked TODO still need
/// a Somali translation and native review.
class Strings {
  static const appTitle = 'Graveyard Locator';
  static const saveGrave = 'Save a Grave';
  static const findMemorial = 'Find Family Memorial';
  static const takePhoto = 'Take Photo';
  static const nameLabel = 'Name of the person';
  static const locating = 'Finding the location...';
  static const locationOff = 'Turn on location for this app.';
  static const save = 'Save';
  static const done = 'Done';
  static const showFamilyCard = 'Show Family Card';
  static const familyCard = 'Family Card';
  static const waitingForConnection = 'Saved, waiting for connection';

  static String graveSaved(String name) =>
      "$name's grave location has been saved.";
}

class SomaliApproved {
  static const graveSaved = 'Goobta qabriga waa la kaydiyey';
  static const needsAttention = 'Wuxuu u baahan yahay fiiro gaar ah';
  static const caretakerVisited = 'Ilaaliyaha ayaa booqday';
  static const placeFlowers = 'Ubax ii dhig qabriga';
  static const requestReceived =
      'Codsigaaga waa la helay. Warbixin ayaad heli doontaa markay shaqadu dhamaystirmayso.';
  static const familyCard = 'Kaadhka qoyska';
}
