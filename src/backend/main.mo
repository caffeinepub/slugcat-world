import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Iter "mo:core/Iter";
import Array "mo:core/Array";
import Order "mo:core/Order";
import Text "mo:core/Text";

actor {
  type Mod = {
    id : Text;
    name : Text;
    description : Text;
    author : Text;
    version : Text;
    jsonContent : Text;
    enabled : Bool;
    createdAt : Time.Time;
  };

  module Mod {
    public func compareByName(mod1 : Mod, mod2 : Mod) : Order.Order {
      Text.compare(mod1.name, mod2.name);
    };
  };

  let modStore = Map.empty<Text, Mod>();

  public shared ({ caller }) func addMod(id : Text, name : Text, description : Text, author : Text, version : Text, jsonContent : Text) : async () {
    if (modStore.containsKey(id)) {
      Runtime.trap("Mod with this ID already exists");
    };

    let newMod : Mod = {
      id;
      name;
      description;
      author;
      version;
      jsonContent;
      enabled = false;
      createdAt = Time.now();
    };

    modStore.add(id, newMod);
  };

  public shared ({ caller }) func toggleModEnabled(id : Text) : async () {
    switch (modStore.get(id)) {
      case (null) {
        Runtime.trap("Mod not found");
      };
      case (?mod) {
        let updatedMod = { mod with enabled = not mod.enabled };
        modStore.add(id, updatedMod);
      };
    };
  };

  public shared ({ caller }) func deleteMod(id : Text) : async () {
    if (not modStore.containsKey(id)) {
      Runtime.trap("Mod not found");
    };
    modStore.remove(id);
  };

  public query ({ caller }) func getMod(id : Text) : async Mod {
    switch (modStore.get(id)) {
      case (null) {
        Runtime.trap("Mod not found");
      };
      case (?mod) {
        mod;
      };
    };
  };

  public query ({ caller }) func listMods() : async [Mod] {
    modStore.values().toArray().sort(Mod.compareByName);
  };
};
