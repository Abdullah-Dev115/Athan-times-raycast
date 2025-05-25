import {
  Action,
  ActionPanel,
  Form,
  Icon,
  List,
  openExtensionPreferences,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { City, Country, UserSelection, AthanResponse, AthanTimings, GeoNamesResponse } from "./types/types";
import { useLocalStorage } from "@raycast/utils";
import { config } from "./config";

function LocationForm() {
  // Countries
  const [countries, setCountries] = useState<Country[]>();

  // Cities
  const [cities, setCities] = useState<City[]>();
  const [loadingCities, setLoadingCities] = useState(false);

  const {
    value: selectedCountry,
    setValue: setSelectedCountry,
    isLoading: isLoadingCountry,
  } = useLocalStorage<Country | undefined>("selectedCountry", undefined);

  const {
    value: selectedCity,
    setValue: setSelectedCity,
    isLoading: isLoadingCity,
  } = useLocalStorage<string | undefined>("selectedCity", undefined);

  useEffect(() => {
    async function fetchCountries() {
      try {
        console.log("Start Fetching countries...");

        const response = await fetch("https://api.countrystatecity.in/v1/countries/", {
          headers: {
            // Raycast will bundle this environment variable
            "X-CSCAPI-KEY": config.countryStateCityApiKey,
          },
        });
        const data = (await response.json()) as Country[];

        const filteredCountries = data.filter((country) => country.iso2 !== "IL");

        console.log("Countries fetched : ", data.length);
        setCountries(filteredCountries);
      } catch (error) {
        console.error("Failed to fetch countries:", error);
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to fetch countries",
          // Question
          message: error instanceof Error ? error.message : "Unknown Error",
        });
      }
    }
    fetchCountries();
  }, []);

  useEffect(() => {
    async function fetchCities() {
      if (!selectedCountry) {
        setCities(undefined);
        return;
      }

      console.log("Fetching cities for country : ", selectedCountry);
      setLoadingCities(true);

      try {
        // const response = await fetch(
        //   `https://api.countrystatecity.in/v1/countries/PS/cities`,
        //   {
        //     headers: {
        //       "X-CSCAPI-KEY": "dDM5Ulc1SjhPN0lFVG5JeWFqMW4zVW1yOWhsSGdIS3NPZGdwNEV4ag==",
        //     },
        //   },
        // );
        const response = await fetch(
          `http://api.geonames.org/searchJSON?country=${selectedCountry.iso2}&featureClass=P&maxRows=1000&username=${config.geonamesUsername}`,
        );

        const data = (await response.json()) as GeoNamesResponse;

        console.log("Cities Fetched : ", data.geonames.length);

        setCities(data.geonames);
      } catch (error) {
        setCities([]);
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to fetch cities",
          message: error instanceof Error ? error.message : "Unknown Error",
        });
      } finally {
        setLoadingCities(false);
      }
    }
    fetchCities();
  }, [selectedCountry]);

  const isLoading = isLoadingCountry || isLoadingCity || loadingCities || !countries;

  return (
    <Form
      isLoading={isLoading}
      navigationTitle="Location Form"
      actions={
        <ActionPanel>
          <Action.Push
            title="Show Athan Times"
            target={<AthanTimes selectedCountry={selectedCountry} selectedCity={selectedCity} />}
          />
          <Action
            title="Clear Saved Data"
            style={Action.Style.Destructive}
            onAction={async () => {
              await setSelectedCountry(undefined);
              await setSelectedCity(undefined);
              showToast({
                style: Toast.Style.Success,
                title: "Saved data cleared",
              });
            }}
          />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        id="country"
        title="country"
        value={selectedCountry?.iso2}
        onChange={async (value) => {
          const country = countries?.find((country) => country.iso2 === value);
          if (country) {
            await setSelectedCountry(country);
            // Clearing city when country changes
            await setSelectedCity(undefined);
          }
        }}
      >
        <Form.Dropdown.Item title="Select a country..." value="" />
        {countries?.map((country) => {
          return (
            <Form.Dropdown.Item key={country.iso2} value={country.iso2} title={country.name} icon={country.emoji} />
          );
        })}
      </Form.Dropdown>

      {selectedCountry && (
        <Form.Dropdown id="city" title="city" value={selectedCity || ""} onChange={setSelectedCity}>
          <Form.Dropdown.Item title="Select a city..." value="" />
          {cities?.map((city) => {
            return <Form.Dropdown.Item key={city.name} value={city.name} title={city.name} />;
          })}
        </Form.Dropdown>
      )}

      {selectedCountry && (
        <Form.Description text={`Selected: ${selectedCountry.name}${selectedCity ? `, ${selectedCity}` : ""}`} />
      )}
    </Form>
  );
}

function AthanTimes({ selectedCountry, selectedCity }: UserSelection) {
  const [athanTimes, setAthanTimes] = useState<AthanTimings>();
  const [loadingTimes, setLoadingTimes] = useState(false);
  const { push } = useNavigation();

  const { setValue: setSelectedCountry } = useLocalStorage<Country | undefined>("selectedCountry", undefined);
  const { setValue: setSelectedCity } = useLocalStorage<string | undefined>("selectedCity", undefined);

  async function clearSavedLocation() {
    try {
      await setSelectedCountry(undefined);
      await setSelectedCity(undefined);

      showToast({
        style: Toast.Style.Success,
        title: "Location cleared",
        message: "You'll be redirected to location selection",
      });

      push(<LocationForm />);
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to clear location",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  useEffect(() => {
    async function getAthanTimes() {
      if (!selectedCountry || !selectedCity) {
        console.log("Missing country or city :", { selectedCountry, selectedCity });
        return;
      }

      try {
        setLoadingTimes(true);
        console.log("Fetching Athan times for:", { selectedCountry, selectedCity });

        const response = await fetch(
          `https://api.aladhan.com/v1/timingsByCity?country=${selectedCountry.name}&city=${selectedCity}`,
        );

        const data = (await response.json()) as AthanResponse;

        // console.log("Full Response : ", data);
        // console.log("Athan Times : ", data.data.timings);

        setAthanTimes(data.data.timings);

        showToast({
          style: Toast.Style.Success,
          title: "Athan times loaded successfully",
        });
      } catch (error) {
        console.error("Failed to fetch athan times : ", error);
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to fetch athan times",
          message: error instanceof Error ? error.message : "Unknown Error",
        });
      } finally {
        setLoadingTimes(false);
      }
    }
    getAthanTimes();
  }, [selectedCountry, selectedCity]);

  if (loadingTimes) {
    showToast({
      style: Toast.Style.Animated,
      title: "Loading...",
    });
    return <List isLoading={true} navigationTitle="Loading Athan Times..." />;
  }

  if (!athanTimes) {
    showToast({
      style: Toast.Style.Failure,
      title: "No Athan Times Available",
    });
    return (
      <List navigationTitle="Athan Times">
        <List.EmptyView title="No Athan Times Available" description="Please select a country and city first" />
      </List>
    );
  }

  return (
    <List
      navigationTitle={`Athan Times - ${selectedCountry?.name}, ${selectedCity}`}
      // To Fix : Main action are not showing
      actions={
        <ActionPanel>
          <ActionPanel.Section title="Settings">
            <Action title="Open Preferences" onAction={openExtensionPreferences} icon={Icon.Gear} />
            <Action title="Change Location" onAction={clearSavedLocation} icon={Icon.Map} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    >
      <List.Item
        title="Fajr (الفجر)"
        icon={Icon.MoonDown}
        accessories={[{ text: athanTimes.Fajr }]}
        actions={
          <ActionPanel>
            <Action title="Open Preferences" onAction={openExtensionPreferences} icon={Icon.Gear} />
            <Action title="Change Location" onAction={clearSavedLocation} icon={Icon.Map} />
          </ActionPanel>
        }
      />
      <List.Item
        title="Sunrise (الشروق)"
        icon={Icon.Sunrise}
        accessories={[{ text: athanTimes.Sunrise }]}
        actions={
          <ActionPanel>
            <Action title="Open Preferences" onAction={openExtensionPreferences} icon={Icon.Gear} />
            <Action title="Change Location" onAction={clearSavedLocation} icon={Icon.Map} />
          </ActionPanel>
        }
      />
      <List.Item
        title="Dhuhr (الظهر)"
        icon={Icon.Sun}
        accessories={[{ text: athanTimes.Dhuhr }]}
        actions={
          <ActionPanel>
            <Action title="Open Preferences" onAction={openExtensionPreferences} icon={Icon.Gear} />
            <Action title="Change Location" onAction={clearSavedLocation} icon={Icon.Map} />
          </ActionPanel>
        }
      />
      <List.Item
        title="Asr (العصر)"
        icon={Icon.Sun}
        accessories={[{ text: athanTimes.Asr }]}
        actions={
          <ActionPanel>
            <Action title="Open Preferences" onAction={openExtensionPreferences} icon={Icon.Gear} />
            <Action title="Change Location" onAction={clearSavedLocation} icon={Icon.Map} />
          </ActionPanel>
        }
      />
      <List.Item
        title="Maghrib - Sunset (المغرب)"
        icon={Icon.MoonUp}
        accessories={[{ text: athanTimes.Maghrib }]}
        actions={
          <ActionPanel>
            <Action title="Open Preferences" onAction={openExtensionPreferences} icon={Icon.Gear} />
            <Action title="Change Location" onAction={clearSavedLocation} icon={Icon.Map} />
          </ActionPanel>
        }
      />
      <List.Item
        title="Isha (العشاء)"
        icon={Icon.Moon}
        accessories={[{ text: athanTimes.Isha }]}
        actions={
          <ActionPanel>
            <Action title="Open Preferences" onAction={openExtensionPreferences} icon={Icon.Gear} />
            <Action title="Change Location" onAction={clearSavedLocation} icon={Icon.Map} />
          </ActionPanel>
        }
      />
      <List.Item
        title="First third (الثلث الأول من الليل)"
        icon={Icon.StackedBars1}
        accessories={[{ text: athanTimes.Firstthird }]}
      />
      <List.Item
        title="Last third (الثلث الأخير من الليل)"
        icon={Icon.StackedBars3}
        accessories={[{ text: athanTimes.Lastthird }]}
      />
    </List>
  );
}

function Welcome() {
  <List
    actions={
      <ActionPanel>
        <Action.Push title="Location Form" target={<LocationForm />} />
      </ActionPanel>
    }
  >
    <List.EmptyView
      title="Welcome to Athan Times"
      icon={{ source: "https://i.postimg.cc/90X0Jn4y/extension-icon-32x32.png" }}
      description="Please select a country and city to get started"
    />
  </List>;
}

export default function Command() {
  const { value: savedCountry } = useLocalStorage<Country | undefined>("selectedCountry", undefined);
  const { value: savedCity } = useLocalStorage<string | undefined>("selectedCity", undefined);

  if (savedCountry && savedCity) {
    return <AthanTimes selectedCountry={savedCountry} selectedCity={savedCity} />;
  }
  return (
    <List
      searchBarAccessory={<List.Dropdown value="Testing" onChange={() => {}} tooltip="Select a country" />}
      actions={
        <ActionPanel>
          <Action.Push title="Location Form" target={<LocationForm />} />
        </ActionPanel>
      }
    >
      <List.EmptyView
        title="Welcome to Athan Times"
        icon={{ source: "https://i.postimg.cc/FH8nxF3q/Icon-100.png" }}
        description="Please select a country and city to get started"
      />
    </List>
  );
}
